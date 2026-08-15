import type { Sku, StoreRecord } from "@/lib/store/types";
import { config } from "@/lib/config";

export type ParsedInventory = {
  name: string;
  slug: string;
  skus: Omit<Sku, "id">[];
};

export type MerchantDraftLine = {
  quantity: number;
  title: string;
  name?: string;
};

export type MerchantDraft = {
  name?: string;
  slug?: string;
  lines: MerchantDraftLine[];
};

/** Accept legacy single-line drafts from older clients. */
export function normalizeDraft(
  draft:
    | MerchantDraft
    | { quantity: number; title: string; name?: string; lines?: MerchantDraftLine[] }
    | null
    | undefined,
): MerchantDraft | null {
  if (!draft) return null;
  if (Array.isArray(draft.lines) && draft.lines.length > 0) {
    return {
      name: draft.name,
      slug: "slug" in draft ? draft.slug : undefined,
      lines: draft.lines.map((line) => ({
        quantity: Number(line.quantity),
        title: String(line.title).trim(),
        name: line.name,
      })),
    };
  }
  if ("quantity" in draft && "title" in draft && draft.title) {
    return {
      name: draft.name,
      lines: [
        {
          quantity: Number(draft.quantity),
          title: String(draft.title).trim(),
          name: draft.name,
        },
      ],
    };
  }
  return null;
}

export type InventoryParseResult =
  | { ok: true; inventory: ParsedInventory }
  | {
      ok: false;
      missing: "price";
      draft: MerchantDraft;
      ask: string;
    }
  | {
      ok: false;
      missing: "inventory";
      draft: null;
      ask: string;
    };

export function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 48) || "store"
  );
}

function cleanPrompt(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function stripSellerPreamble(text: string) {
  return text
    .replace(
      /^(?:create a store[.!]?\s*)?(?:i(?:'m| am) selling|selling|sell)\s+/i,
      "",
    )
    .replace(
      /^(?:i\s+wanna\s+set\s+up|i\s+want\s+to\s+set\s+up|set\s+up)\s+(?:a\s+)?(?:\w+\s+)*store[,.]?\s*/i,
      "",
    )
    .trim();
}

function normalizeTitle(raw: string) {
  return raw
    .replace(/\s+for\s+\d+(?:\.\d+)?\s*(?:xsgd|sgd)?\.?$/i, "")
    .replace(/[.,!;:?]+$/g, "")
    .trim();
}

function storeNameFromTitle(title: string) {
  if (/hackathon/i.test(title)) return "StraitsX Hackathon Shirts";
  return title.replace(/\b\w/g, (c) => c.toUpperCase());
}

function looksLikeGreetingOrChat(text: string) {
  const t = cleanPrompt(text).toLowerCase().replace(/[!?.]+$/g, "");
  if (!t) return true;
  if (
    /^(hi|hello|hey|yo|sup|thanks|thank you|thx|ok|okay|cool|nice|help|what|whats|what's|whatt|huh|hm+|umm+|idk|lol|haha|test)$/i.test(
      t,
    )
  ) {
    return true;
  }
  if (
    /^(hi|hello|hey)\b/.test(t) &&
    !/\d+\s+\w+/.test(t) &&
    !/\bselling\b/i.test(t)
  ) {
    return true;
  }
  if (
    /^(what|how|why|who|where|can you|could you|help)\b/i.test(t) &&
    !/\bselling\b/i.test(t) &&
    !/\d+\s+[a-z]/i.test(t)
  ) {
    return true;
  }
  return false;
}

function hasSellIntent(text: string) {
  return /(?:create\s+a\s+store|i(?:'m| am)\s+selling|\bselling\b|\bsell\b|set\s+up\s+(?:a\s+)?\w+\s+store)/i.test(
    text,
  );
}

/** Price-only follow-up after we asked "how much?" */
export function parsePriceOnly(text: string): string | null {
  const cleaned = cleanPrompt(text);
  const match = cleaned.match(
    /^(?:for\s+)?(\d+(?:\.\d+)?)\s*(?:xsgd|sgd)?(?:\s+each)?\.?$/i,
  );
  return match ? Number(match[1]).toFixed(2) : null;
}

function guideAsk() {
  return `Tell me what you're selling — quantity, product, and price in ${config.tokenSymbol}. Example: "10 water bottles for 2 XSGD each".`;
}

function priceAsk(draft: MerchantDraft) {
  if (draft.lines.length === 1) {
    const { quantity, title } = draft.lines[0];
    const unit = title.replace(/s$/i, "") || title;
    return `Got it — ${quantity} ${title}. Fill in the ${config.tokenSymbol} price below (or reply e.g. "2 ${config.tokenSymbol} each").`;
  }
  const list = draft.lines
    .map((l) => `${l.quantity} ${l.title}`)
    .join(", ");
  return `Got it — ${list}. Fill in a ${config.tokenSymbol} price for each product below.`;
}

function draftFromLines(
  lines: MerchantDraftLine[],
  storeHint?: string,
): MerchantDraft {
  const name =
    storeHint ||
    (lines.length === 1
      ? storeNameFromTitle(lines[0].title)
      : "Aisle Store");
  return {
    name,
    slug: slugify(name),
    lines,
  };
}

/** Extract "5 shirts, 5 jeans, 10 socks" style lines (optionally with prices). */
export function extractInventoryLines(text: string): {
  lines: Array<MerchantDraftLine & { price?: string }>;
  storeHint?: string;
} | null {
  const cleaned = cleanPrompt(text);
  if (!cleaned) return null;

  const storeMatch = cleaned.match(
    /(?:set\s+up|open|create)\s+(?:a\s+)?([a-z][a-z\s]{0,40}?)\s+store/i,
  );
  const storeHint = storeMatch
    ? storeNameFromTitle(storeMatch[1].trim())
    : undefined;

  const body = stripSellerPreamble(cleaned);
  const withPrices: Array<MerchantDraftLine & { price?: string }> = [];

  // "5 shirts for 2 XSGD, 5 jeans at 10"
  const pricedRe =
    /(\d+)\s+([a-z][a-z0-9\s-]{0,40}?)\s+(?:for|at|@|=)\s+(\d+(?:\.\d+)?)\s*(?:xsgd|sgd)?(?:\s+each)?/gi;
  let m: RegExpExecArray | null;
  const pricedSpans: Array<{ start: number; end: number }> = [];
  while ((m = pricedRe.exec(body)) !== null) {
    withPrices.push({
      quantity: Number(m[1]),
      title: normalizeTitle(m[2]),
      price: Number(m[3]).toFixed(2),
    });
    pricedSpans.push({ start: m.index, end: m.index + m[0].length });
  }

  // Strip priced spans then find qty+title without price
  let remainder = body;
  for (const span of [...pricedSpans].reverse()) {
    remainder =
      remainder.slice(0, span.start) + " " + remainder.slice(span.end);
  }
  remainder = remainder.replace(/\s+/g, " ").trim();

  const bareRe = /(\d+)\s+([a-z][a-z0-9\s-]{1,40}?)(?=\s*(?:,|and|&|\d+\s+[a-z]|$))/gi;
  while ((m = bareRe.exec(remainder)) !== null) {
    const title = normalizeTitle(m[2]);
    if (!title || title.length < 2) continue;
    if (looksLikeGreetingOrChat(title)) continue;
    withPrices.push({ quantity: Number(m[1]), title });
  }

  // Single "10 water bottles" leftover
  if (withPrices.length === 0) {
    const single = remainder.match(/^(\d+)\s+([a-z].+)$/i);
    if (single) {
      const title = normalizeTitle(single[2]);
      if (title && !looksLikeGreetingOrChat(title)) {
        withPrices.push({ quantity: Number(single[1]), title });
      }
    }
  }

  if (withPrices.length === 0) return null;
  return { lines: withPrices, storeHint };
}

export function parseMerchantPrompt(text: string): InventoryParseResult {
  const cleaned = cleanPrompt(text);
  if (!cleaned || looksLikeGreetingOrChat(cleaned)) {
    return { ok: false, missing: "inventory", draft: null, ask: guideAsk() };
  }

  const extracted = extractInventoryLines(cleaned);
  if (extracted && extracted.lines.length > 0) {
    const missingPrice = extracted.lines.some(
      (l) => !l.price || !Number.isFinite(Number(l.price)) || Number(l.price) <= 0,
    );
    if (missingPrice) {
      const draft = draftFromLines(
        extracted.lines.map(({ quantity, title }) => ({ quantity, title })),
        extracted.storeHint,
      );
      return {
        ok: false,
        missing: "price",
        draft,
        ask: priceAsk(draft),
      };
    }
    const skus = extracted.lines.map((line) => {
      const isHackathon = /hackathon/i.test(line.title);
      return {
        title: isHackathon ? "StraitsX Hackathon Shirt" : line.title,
        description: `${line.quantity} ${line.title} for ${line.price} ${config.tokenSymbol}`,
        quantity: line.quantity,
        price: String(line.price),
      };
    });
    const isHackathon = skus.some((s) => /hackathon/i.test(s.title));
    const name = isHackathon
      ? "StraitsX Hackathon Shirts"
      : extracted.storeHint ||
        (skus.length === 1
          ? storeNameFromTitle(skus[0].title)
          : "Aisle Store");
    return {
      ok: true,
      inventory: {
        name,
        slug: isHackathon ? "hackathon-shirts" : slugify(name),
        skus,
      },
    };
  }

  const sellIntent = hasSellIntent(cleaned);
  if (sellIntent && !parsePriceOnly(cleaned)) {
    return {
      ok: false,
      missing: "inventory",
      draft: null,
      ask: `Almost — I need quantity + product (+ price). Example: "5 shirts, 5 jeans, 10 socks" then set prices.`,
    };
  }

  return { ok: false, missing: "inventory", draft: null, ask: guideAsk() };
}

/** Merge a single price reply onto a pending draft (first line without price / only line). */
export function completeDraftWithPrice(
  draft: MerchantDraft,
  priceText: string,
): InventoryParseResult {
  const normalized = normalizeDraft(draft);
  if (!normalized) {
    return { ok: false, missing: "inventory", draft: null, ask: guideAsk() };
  }
  const price = parsePriceOnly(priceText);
  if (!price) {
    return {
      ok: false,
      missing: "price",
      draft: normalized,
      ask: `Still need prices. Use the form below or reply with a number in ${config.tokenSymbol}.`,
    };
  }
  if (normalized.lines.length === 1) {
    return completeDraftWithPrices(normalized, [price]);
  }
  return {
    ok: false,
    missing: "price",
    draft: normalized,
    ask: priceAsk(normalized),
  };
}

/** Apply prices (by index) to every draft line and publish inventory. */
export function completeDraftWithPrices(
  draft: MerchantDraft,
  prices: Array<string | number | null | undefined>,
): InventoryParseResult {
  const normalized = normalizeDraft(draft);
  if (!normalized) {
    return { ok: false, missing: "inventory", draft: null, ask: guideAsk() };
  }

  const skus: Omit<Sku, "id">[] = [];
  for (let i = 0; i < normalized.lines.length; i++) {
    const line = normalized.lines[i];
    const raw = prices[i];
    const priceNum = Number(String(raw ?? "").replace(/[^\d.]/g, ""));
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      return {
        ok: false,
        missing: "price",
        draft: normalized,
        ask: `Need a ${config.tokenSymbol} price for ${line.quantity} ${line.title}.`,
      };
    }
    const price = priceNum.toFixed(2);
    const isHackathon = /hackathon/i.test(line.title);
    skus.push({
      title: isHackathon ? "StraitsX Hackathon Shirt" : line.title,
      description: `${line.quantity} ${line.title} for ${price} ${config.tokenSymbol}`,
      quantity: line.quantity,
      price,
    });
  }

  const isHackathon = skus.some((s) => /hackathon/i.test(s.title));
  const name = isHackathon
    ? "StraitsX Hackathon Shirts"
    : normalized.name ||
      (skus.length === 1
        ? storeNameFromTitle(skus[0].title)
        : "Aisle Store");

  return {
    ok: true,
    inventory: {
      name,
      slug: isHackathon
        ? "hackathon-shirts"
        : normalized.slug || slugify(name),
      skus,
    },
  };
}

/**
 * Resolve a turn: price follow-up, new inventory, or chat/clarify.
 * If a draft is pending and the user is confused, re-ask for price.
 */
export function resolveMerchantTurn(args: {
  message: string;
  draft?: MerchantDraft | null;
}): InventoryParseResult {
  const message = cleanPrompt(args.message);
  const draft = normalizeDraft(args.draft);

  if (!message) {
    return draft
      ? {
          ok: false,
          missing: "price",
          draft,
          ask: priceAsk(draft),
        }
      : { ok: false, missing: "inventory", draft: null, ask: guideAsk() };
  }

  if (draft) {
    if (parsePriceOnly(message) && draft.lines.length === 1) {
      return completeDraftWithPrice(draft, message);
    }
    if (looksLikeGreetingOrChat(message)) {
      return {
        ok: false,
        missing: "price",
        draft,
        ask: priceAsk(draft),
      };
    }
    return parseMerchantPrompt(message);
  }

  return parseMerchantPrompt(message);
}

export function parseCsv(csv: string): InventoryParseResult {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return parseMerchantPrompt("50 shirts for 50 XSGD");
  }
  const header = lines[0].toLowerCase();
  const hasHeader = /title|name|price|qty|quantity/.test(header);
  const rows = hasHeader ? lines.slice(1) : lines;
  const skus: Omit<Sku, "id">[] = [];
  const missingLines: MerchantDraftLine[] = [];

  for (const row of rows) {
    const cols = row.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    if (hasHeader) {
      const keys = header.split(",").map((k) => k.trim());
      const record = Object.fromEntries(keys.map((k, i) => [k, cols[i] ?? ""]));
      const priceRaw = record.price || record.xsgd;
      const title = record.title || record.name || "Untitled";
      const quantity = Number(record.quantity || record.qty || 1);
      if (!priceRaw || !Number.isFinite(Number(priceRaw))) {
        missingLines.push({ quantity, title, name: title });
        continue;
      }
      skus.push({
        title,
        description: record.description || record.title || "",
        quantity,
        price: Number(priceRaw).toFixed(2),
      });
    } else {
      const title = cols[0] || "Untitled";
      const quantity = Number(cols[1] || 1);
      const priceRaw = cols[2];
      if (!priceRaw || !Number.isFinite(Number(priceRaw))) {
        missingLines.push({ quantity, title, name: title });
        continue;
      }
      skus.push({
        title,
        description: cols[0] || "",
        quantity,
        price: Number(priceRaw).toFixed(2),
      });
    }
  }

  if (missingLines.length > 0) {
    const draft = draftFromLines(missingLines);
    return {
      ok: false,
      missing: "price",
      draft,
      ask: priceAsk(draft),
    };
  }

  const name = skus[0]?.title || "Aisle Store";
  return { ok: true, inventory: { name, slug: slugify(name), skus } };
}

export function toStore(
  parsed: ParsedInventory,
  merchantAddress: `0x${string}` = config.merchantAddress,
): StoreRecord {
  return {
    slug: parsed.slug,
    name: parsed.name,
    merchantAddress,
    createdAt: new Date().toISOString(),
    skus: parsed.skus.map((sku, index) => ({
      id:
        parsed.slug === "hackathon-shirts"
          ? "shirt"
          : slugify(sku.title) || `sku-${index + 1}`,
      ...sku,
    })),
  };
}
