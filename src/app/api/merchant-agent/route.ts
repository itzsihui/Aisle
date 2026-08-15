import { runMerchantAgent } from "@/lib/agents/merchant";
import {
  normalizeDraft,
  type MerchantDraft,
  type MerchantDraftLine,
} from "@/lib/inventory/parse";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      message?: string;
      csv?: string;
      draft?:
        | MerchantDraft
        | {
            quantity: number;
            title: string;
            name?: string;
            lines?: MerchantDraftLine[];
          }
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
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Merchant agent failed";
    console.error("[merchant-agent]", message);
    return Response.json(
      {
        store: null,
        status: "clarify",
        reply: message.includes("security token") ||
          message.includes("credentials") ||
          message.includes("AccessDenied") ||
          message.includes("not authorized")
          ? `Could not publish store (storage/credentials): ${message}. If AISLE_TABLE is set, AWS_* must be the hackathon account that owns DynamoDB; put personal Bedrock keys in BEDROCK_AWS_ACCESS_KEY_ID / BEDROCK_AWS_SECRET_ACCESS_KEY.`
          : `Could not publish store: ${message}`,
        draft: null,
        llm: "deterministic",
      },
      { status: 200 },
    );
  }
}
