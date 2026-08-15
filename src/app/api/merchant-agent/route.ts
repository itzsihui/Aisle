import { runMerchantAgent } from "@/lib/agents/merchant";
import {
  normalizeDraft,
  type MerchantDraft,
  type MerchantDraftLine,
} from "@/lib/inventory/parse";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    message?: string;
    csv?: string;
    draft?:
      | MerchantDraft
      | { quantity: number; title: string; name?: string; lines?: MerchantDraftLine[] }
      | null;
    prices?: Array<string | number | null | undefined>;
  };
  const result = await runMerchantAgent({
    message: body.message,
    csv: body.csv,
    draft: normalizeDraft(body.draft),
    prices: body.prices,
  });
  return Response.json(result);
}
