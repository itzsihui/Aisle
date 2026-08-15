const SESSION_KEY = "aisle.demo.session.v1";

export type SessionStoreRef = {
  slug: string;
  name: string;
  productHint: string;
};

export type OnboardSession = {
  message: string;
  lines: Array<{ role: "merchant" | "aisle"; text: string; llm?: string }>;
  draft: {
    name?: string;
    lines: Array<{ quantity: number; title: string }>;
  } | null;
  prices: string[];
  slug: string | null;
};

export type BuyerSession = {
  input: string;
  lines: Array<{ role: string; text: string }>;
};

export type AisleDemoSession = {
  lastStore?: SessionStoreRef;
  onboard?: OnboardSession;
  buyer?: BuyerSession;
};

function canUseSession() {
  return typeof window !== "undefined" && typeof sessionStorage !== "undefined";
}

export function readDemoSession(): AisleDemoSession {
  if (!canUseSession()) return {};
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as AisleDemoSession;
  } catch {
    return {};
  }
}

export function writeDemoSession(patch: Partial<AisleDemoSession>) {
  if (!canUseSession()) return;
  try {
    const next = { ...readDemoSession(), ...patch };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
  } catch {
    // quota / private mode — ignore
  }
}

/** "iphones" → "iphone", "jeans" → "jeans" */
export function singularProductHint(title: string) {
  const t = title.trim().toLowerCase().replace(/\s+/g, " ");
  if (!t) return "item";
  if (t.endsWith("ies") && t.length > 4) return `${t.slice(0, -3)}y`;
  if (t.endsWith("sses")) return t.slice(0, -2);
  if (t.endsWith("s") && !t.endsWith("ss") && t.length > 3) return t.slice(0, -1);
  return t;
}

export function storeRefFromPublish(store: {
  slug: string;
  name?: string;
  skus?: Array<{ title: string }>;
}): SessionStoreRef {
  const first = store.skus?.[0]?.title || store.name || "item";
  return {
    slug: store.slug,
    name: store.name || store.slug,
    productHint: singularProductHint(first),
  };
}

export function defaultBuyerPrompt(store?: SessionStoreRef | null) {
  if (!store?.slug) {
    return "Agent, go to /s/hackathon-shirts and buy a hackathon shirt.";
  }
  const product = store.productHint || "item";
  const article = /^[aeiou]/i.test(product) ? "an" : "a";
  return `Agent, go to /s/${store.slug} and buy ${article} ${product}.`;
}

export const DEFAULT_ONBOARD_MESSAGE =
  "i wanna set up a phone store, 5 iphones, 5 samsungs";

export const DEFAULT_ONBOARD_LINES: OnboardSession["lines"] = [
  {
    role: "aisle",
    text: "Describe inventory (or drop a CSV). I'll extract products, ask for XSGD prices, then publish llms.txt + agent.json for buying agents.",
  },
];

export const DEFAULT_BUYER_LINES: BuyerSession["lines"] = [
  {
    role: "agent",
    text: "Buyer agent ready. I will read llms.txt / agent.json, not HTML.",
  },
];
