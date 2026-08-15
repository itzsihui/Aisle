import {
  createWalletClient,
  http,
  publicActions,
  parseAbi,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { avalanche, avalancheFuji } from "viem/chains";
import { config, explorerTx } from "@/lib/config";
import { emit } from "@/lib/protocol/events";

const erc20 = parseAbi([
  "function transfer(address to, uint256 amount) returns (bool)",
]);

export type BuyerStep = {
  type: "info" | "http" | "chain" | "error" | "success";
  text: string;
};

export type BuyerReceipt = {
  orderId?: string;
  explorerUrl?: string;
  txHash?: string;
  amount?: string;
  rail?: string;
  status?: string;
  [key: string]: unknown;
};

function normalizeProductToken(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Pull "earring" from "buy a earring" / "buy earrings from …". */
export function extractRequestedProduct(message?: string): string | null {
  if (!message?.trim()) return null;
  const cleaned = message.replace(/\/s\/[a-z0-9-]+/gi, " ").replace(/\s+/g, " ");
  const patterns = [
    /buy\s+(?:an?\s+|the\s+|one\s+|1\s+)?(.+?)(?:\s+from|\s+at|\s+in|\s+on|$)/i,
    /(?:want|get|purchase)\s+(?:an?\s+|the\s+|one\s+|1\s+)?(.+?)(?:\s+from|\s+at|\s+in|$)/i,
  ];
  for (const re of patterns) {
    const match = cleaned.match(re);
    if (!match?.[1]) continue;
    let product = normalizeProductToken(match[1]);
    product = product
      .replace(/\b(hackathon|item|product|sku|please)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!product || product.length < 2) continue;
    // Vague buys — let catalog default apply
    if (/^(something|anything|one|it|that|this)$/i.test(product)) return null;
    return product;
  }
  return null;
}

function productMatches(
  requested: string,
  product: { id: string; title: string },
): boolean {
  const req = normalizeProductToken(requested);
  const title = normalizeProductToken(product.title);
  const id = normalizeProductToken(product.id);
  if (!req) return false;
  if (title === req || id === req) return true;
  if (title.includes(req) || req.includes(title)) return true;
  if (id.includes(req) || req.includes(id)) return true;
  // singular / plural
  const stem = (s: string) => s.replace(/s$/i, "");
  if (stem(title) === stem(req) || stem(id) === stem(req)) return true;
  return false;
}

function pickSku(
  products: Array<{ id: string; title: string }>,
  args: { product?: string; message?: string },
):
  | { ok: true; sku: { id: string; title: string } }
  | { ok: false; requested: string; available: string } {
  const requested =
    args.product?.trim() || extractRequestedProduct(args.message) || null;
  if (!requested) {
    return { ok: true, sku: products[0] };
  }
  const match = products.find((p) => productMatches(requested, p));
  if (match) return { ok: true, sku: match };
  return {
    ok: false,
    requested,
    available: products.map((p) => p.title).join(", ") || "(empty)",
  };
}

/** Deterministic x402 handshake — works with or without Bedrock. */
export async function payX402Tool(args: {
  origin: string;
  slug?: string;
  message?: string;
  /** Product name or sku id the buyer asked for */
  product?: string;
}): Promise<{ steps: BuyerStep[]; receipt?: BuyerReceipt }> {
  const steps: BuyerStep[] = [];
  const slug =
    args.slug ||
    args.message?.match(/\/s\/([a-z0-9-]+)/i)?.[1] ||
    args.message?.match(/buy .+ from ([a-z0-9-]+)/i)?.[1] ||
    "hackathon-shirts";
  const base = `${args.origin}/s/${slug}`;

  steps.push({ type: "info", text: `Discovering ${base}/llms.txt` });
  const llms = await fetch(`${base}/llms.txt`);
  const llmsText = await llms.text();
  steps.push({
    type: "http",
    text: `GET llms.txt → ${llms.status} (${llmsText.split("\n")[0]})`,
  });

  steps.push({ type: "info", text: "Loading ACP catalog" });
  const catalogRes = await fetch(`${base}/catalog.json`);
  const catalog = (await catalogRes.json()) as {
    products?: Array<{ id: string; title: string }>;
  };
  const products = catalog.products ?? [];
  if (products.length === 0) {
    steps.push({ type: "error", text: "Catalog empty — nothing to buy in this store." });
    return { steps };
  }

  const picked = pickSku(products, args);
  if (!picked.ok) {
    steps.push({
      type: "http",
      text: `GET catalog.json → ${catalogRes.status} (${products.length} SKU(s): ${picked.available})`,
    });
    steps.push({
      type: "error",
      text: `"${picked.requested}" does not exist in this store. Available: ${picked.available}.`,
    });
    return { steps };
  }
  const sku = picked.sku;
  steps.push({
    type: "http",
    text: `GET catalog.json → ${catalogRes.status} matched ${sku.title}`,
  });

  const orderId = crypto.randomUUID();
  steps.push({ type: "info", text: `POST ${base}/buy (no payment)` });
  const first = await fetch(`${base}/buy`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ skuId: sku.id, quantity: 1, orderId }),
  });
  const challenge = (await first.json()) as {
    accepts?: Array<{
      maxAmountRequired: string;
      payTo: `0x${string}`;
    }>;
  };
  steps.push({
    type: "http",
    text: `HTTP ${first.status} ${first.status === 402 ? "Payment Required" : ""}`,
  });

  if (first.status !== 402) {
    steps.push({ type: "error", text: "Expected 402 challenge" });
    return { steps };
  }

  const accept = challenge.accepts?.[0];
  if (!accept) {
    steps.push({ type: "error", text: "402 missing accepts[]" });
    return { steps };
  }

  if (!config.buyerPrivateKey) {
    emit({
      status: 402,
      method: "POST",
      path: `${base}/buy`,
      store: slug,
      orderId,
      rail: "x402",
      message: "402 unpaid: BUYER_PRIVATE_KEY missing, cannot sign on Avalanche",
    });
    steps.push({
      type: "error",
      text: "402 is the challenge. Add BUYER_PRIVATE_KEY + funded XSGD, then Buy again.",
    });
    return { steps, receipt: challenge as BuyerReceipt };
  }

  const chain = config.network === "avalanche" ? avalanche : avalancheFuji;
  const account = privateKeyToAccount(config.buyerPrivateKey);
  const wallet = createWalletClient({
    account,
    chain,
    transport: http(config.rpcUrl),
  }).extend(publicActions);

  steps.push({
    type: "chain",
    text: `Signing ${config.tokenSymbol} transfer ${accept.maxAmountRequired} → ${accept.payTo} on Avalanche`,
  });
  let txHash: `0x${string}`;
  try {
    txHash = await wallet.writeContract({
      address: config.tokenAddress,
      abi: erc20,
      functionName: "transfer",
      args: [accept.payTo, BigInt(accept.maxAmountRequired)],
      // Fuji sandbox XSGD returns absurd eth_estimateGas; hard-cap for ERC-20 transfer.
      gas: 150_000n,
    });
    await wallet.waitForTransactionReceipt({ hash: txHash });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "transfer failed";
    emit({
      status: 402,
      method: "POST",
      path: `${base}/buy`,
      store: slug,
      orderId,
      rail: "x402",
      message: `402 unsigned: ${reason}`,
    });
    steps.push({ type: "error", text: reason });
    return { steps, receipt: challenge as BuyerReceipt };
  }
  const snowtrace = explorerTx(txHash);
  steps.push({ type: "chain", text: `Settled ${txHash}` });
  steps.push({ type: "success", text: snowtrace });

  const signature = Buffer.from(JSON.stringify({ txHash })).toString("base64");
  const second = await fetch(`${base}/buy`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "PAYMENT-SIGNATURE": signature,
    },
    body: JSON.stringify({ skuId: sku.id, quantity: 1, orderId }),
  });
  const secondText = await second.text();
  let receipt: BuyerReceipt;
  try {
    receipt = JSON.parse(secondText) as BuyerReceipt;
  } catch {
    const snippet = secondText.slice(0, 160).replace(/\s+/g, " ");
    steps.push({
      type: "error",
      text: `HTTP ${second.status} non-JSON from /buy: ${snippet}`,
    });
    return {
      steps,
      receipt: { txHash, explorerUrl: snowtrace, status: "verify-failed" },
    };
  }
  if (!receipt.explorerUrl && txHash) {
    receipt.explorerUrl = snowtrace;
    receipt.txHash = txHash;
  }
  steps.push({
    type: second.ok ? "success" : "error",
    text: `HTTP ${second.status} ${second.ok ? "receipt unlocked" : JSON.stringify(receipt)}`,
  });
  if (second.ok && receipt.explorerUrl) {
    steps.push({ type: "success", text: receipt.explorerUrl });
  }
  return { steps, receipt };
}
