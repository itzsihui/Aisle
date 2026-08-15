"use client";

import { FormEvent, useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import {
  MerchantChat,
  PriceDraftForm,
  type ChatLine,
} from "@/components/onboard/merchant-chat";
import {
  DiscoveryPane,
  EndpointLab,
} from "@/components/onboard/discovery-panes";
import {
  normalizeDraft,
  type MerchantDraft,
} from "@/lib/inventory/parse";
import {
  DEFAULT_ONBOARD_LINES,
  DEFAULT_ONBOARD_MESSAGE,
  defaultBuyerPrompt,
  readDemoSession,
  storeRefFromPublish,
  writeDemoSession,
} from "@/lib/demo-session";

export default function OnboardPage() {
  const [hydrated, setHydrated] = useState(false);
  const [message, setMessage] = useState(DEFAULT_ONBOARD_MESSAGE);
  const [lines, setLines] = useState<ChatLine[]>(DEFAULT_ONBOARD_LINES);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<MerchantDraft | null>(null);
  const [prices, setPrices] = useState<string[]>([]);
  const [slug, setSlug] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const session = readDemoSession();
    if (session.onboard) {
      setMessage(session.onboard.message || DEFAULT_ONBOARD_MESSAGE);
      setLines(
        session.onboard.lines?.length
          ? session.onboard.lines
          : DEFAULT_ONBOARD_LINES,
      );
      setDraft(normalizeDraft(session.onboard.draft));
      setPrices(session.onboard.prices ?? []);
      setSlug(session.onboard.slug);
      if (session.onboard.slug) setRefreshKey((k) => k + 1);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeDemoSession({
      onboard: {
        message,
        lines,
        draft,
        prices,
        slug,
      },
    });
  }, [hydrated, message, lines, draft, prices, slug]);

  async function callAgent(payload: {
    message?: string;
    csv?: string;
    draft?: MerchantDraft | null;
    prices?: string[];
  }) {
    setBusy(true);
    try {
      const res = await fetch("/api/merchant-agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const raw = await res.text();
      let data: {
        reply: string;
        store: {
          slug: string;
          name?: string;
          skus?: Array<{ title: string }>;
        } | null;
        status?: "published" | "need_price" | "clarify";
        draft?: MerchantDraft | null;
        llm?: string;
      };
      try {
        data = JSON.parse(raw) as typeof data;
      } catch {
        throw new Error(
          raw.trim()
            ? `Merchant agent returned non-JSON (${res.status})`
            : `Merchant agent returned empty response (${res.status})`,
        );
      }
      if (!data.reply) {
        data.reply = "No reply from merchant agent.";
      }
      const nextDraft =
        data.status === "need_price" ? normalizeDraft(data.draft) : null;
      setDraft(nextDraft);
      setPrices(nextDraft ? nextDraft.lines.map(() => "") : []);
      if (data.store?.slug) {
        setSlug(data.store.slug);
        setRefreshKey((k) => k + 1);
        const ref = storeRefFromPublish(data.store);
        writeDemoSession({
          lastStore: ref,
          buyer: {
            input: defaultBuyerPrompt(ref),
            lines: readDemoSession().buyer?.lines ?? [
              {
                role: "agent",
                text: "Buyer agent ready. I will read llms.txt / agent.json, not HTML.",
              },
            ],
          },
        });
      }
      setLines((prev) => [
        ...prev,
        {
          role: "aisle",
          text: data.reply,
          llm: data.llm,
        },
      ]);
    } catch (error) {
      setLines((prev) => [
        ...prev,
        {
          role: "aisle",
          text:
            error instanceof Error
              ? error.message
              : "Merchant agent request failed",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const text = message.trim();
    if (!text) return;
    setLines((prev) => [...prev, { role: "merchant", text }]);
    setMessage("");
    await callAgent({ message: text, draft });
  }

  async function onFile(file: File) {
    const csv = await file.text();
    setLines((prev) => [
      ...prev,
      { role: "merchant", text: `Uploaded ${file.name}` },
    ]);
    await callAgent({ csv });
  }

  async function onSubmitPrices() {
    if (!draft) return;
    setLines((prev) => [
      ...prev,
      {
        role: "merchant",
        text: draft.lines
          .map((line, i) => `${line.quantity} ${line.title} @ ${prices[i]} XSGD`)
          .join(", "),
      },
    ]);
    await callAgent({ draft, prices });
  }

  return (
    <div className="aisle-grid aisle-grid-soft flex h-[100dvh] p-3 md:p-4">
      <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-lg border border-border bg-background shadow-sm">
        <SiteHeader />
        <main className="grid min-h-0 flex-1 grid-cols-1 pt-16 lg:grid-cols-2">
          <section className="flex min-h-0 flex-col border-b border-border bg-background lg:border-b-0 lg:border-r">
            <div className="shrink-0 border-b border-border px-4 py-3">
              <h1 className="text-lg font-medium tracking-tight">Open a store</h1>
              <p className="mt-0.5 text-xs text-foreground/55">
                Converse → price → publish. Agents get URLs, not a checkout page.
              </p>
            </div>
            <div className="min-h-0 flex-1 bg-background">
              <MerchantChat
                lines={lines}
                message={message}
                setMessage={setMessage}
                busy={busy}
                onSubmit={onSubmit}
                onFile={onFile}
                belowMessages={
                  draft ? (
                    <PriceDraftForm
                      draft={draft}
                      prices={prices}
                      setPrices={setPrices}
                      busy={busy}
                      onSubmit={onSubmitPrices}
                    />
                  ) : null
                }
              />
            </div>
          </section>

          <section className="flex min-h-0 flex-col bg-background">
            <DiscoveryPane slug={slug} refreshKey={refreshKey} />
            <EndpointLab slug={slug} refreshKey={refreshKey} />
          </section>
        </main>
      </div>
    </div>
  );
}
