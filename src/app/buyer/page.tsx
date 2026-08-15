"use client";

import { type FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { ProtocolLog } from "@/components/marketing/protocol-log";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_BUYER_LINES,
  defaultBuyerPrompt,
  readDemoSession,
  writeDemoSession,
} from "@/lib/demo-session";

type Line = { role: string; text: string };

function isUrl(text: string) {
  return /^https?:\/\//i.test(text.trim());
}

export default function BuyerPage() {
  const [hydrated, setHydrated] = useState(false);
  const [storeSlug, setStoreSlug] = useState<string | null>(null);
  const [buyerInput, setBuyerInput] = useState(defaultBuyerPrompt(null));
  const [buyerLines, setBuyerLines] = useState<Line[]>(DEFAULT_BUYER_LINES);
  const [busy, setBusy] = useState<"buyer" | "card" | null>(null);
  const [snowtrace, setSnowtrace] = useState<string | null>(null);

  useEffect(() => {
    const session = readDemoSession();
    const store = session.lastStore ?? null;
    setStoreSlug(store?.slug ?? null);
    if (session.buyer?.input) {
      setBuyerInput(session.buyer.input);
    } else {
      setBuyerInput(defaultBuyerPrompt(store));
    }
    if (session.buyer?.lines?.length) {
      setBuyerLines(session.buyer.lines);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeDemoSession({
      buyer: {
        input: buyerInput,
        lines: buyerLines,
      },
    });
  }, [hydrated, buyerInput, buyerLines]);

  async function runBuyer(event?: FormEvent) {
    event?.preventDefault();
    setBusy("buyer");
    setBuyerLines((prev) => [...prev, { role: "you", text: buyerInput }]);
    try {
      const res = await fetch("/api/buyer-agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: buyerInput }),
      });
      const data = (await res.json()) as {
        steps?: Array<{ type: string; text: string }>;
        error?: string;
        receipt?: { explorerUrl?: string };
        llm?: string;
      };
      const steps = data.steps ?? [];
      if (steps.length === 0) {
        setBuyerLines((prev) => [
          ...prev,
          {
            role: "error",
            text: data.error || `Buyer agent failed (HTTP ${res.status})`,
          },
        ]);
      } else {
        setBuyerLines((prev) => [
          ...prev,
          ...steps.map((step) => ({ role: step.type, text: step.text })),
          ...(data.llm ? [{ role: "info", text: `llm=${data.llm}` }] : []),
        ]);
        if (data.receipt?.explorerUrl) {
          setSnowtrace(data.receipt.explorerUrl);
        }
      }
    } catch (error) {
      setBuyerLines((prev) => [
        ...prev,
        {
          role: "error",
          text: error instanceof Error ? error.message : "Buyer request failed",
        },
      ]);
    } finally {
      setBusy(null);
    }
  }

  async function issueCard() {
    setBusy("card");
    setBuyerLines((prev) => [
      ...prev,
      {
        role: "you",
        text: "Pay with StraitsX scoped virtual card (spend cap · merchant whitelist · burn).",
      },
    ]);
    const merchant =
      storeSlug ||
      buyerInput.match(/\/s\/([a-z0-9-]+)/i)?.[1] ||
      "hackathon-shirts";
    try {
      const res = await fetch("/api/card-mandate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          checkout: true,
          merchant,
          message: buyerInput,
        }),
      });
      const data = (await res.json()) as {
        steps?: Array<{ type: string; text: string }>;
        error?: string;
      };
      const steps = data.steps ?? [];
      if (steps.length === 0) {
        setBuyerLines((prev) => [
          ...prev,
          {
            role: "error",
            text: data.error || `Card rail failed (HTTP ${res.status})`,
          },
        ]);
      } else {
        setBuyerLines((prev) => [
          ...prev,
          ...steps.map((step) => ({ role: step.type, text: step.text })),
        ]);
      }
    } catch (error) {
      setBuyerLines((prev) => [
        ...prev,
        {
          role: "error",
          text: error instanceof Error ? error.message : "Card rail failed",
        },
      ]);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      <SiteHeader />
      <main className="mx-auto flex max-w-[1400px] flex-col gap-6 px-6 pt-20 pb-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-medium tracking-tight">Buyer agent</h1>
            <p className="mt-2 max-w-[52ch] text-foreground/70">
              Separate from merchant setup. Reads agent discovery docs, pays via
              Avalanche x402 or StraitsX scoped card.
              {storeSlug ? (
                <>
                  {" "}
                  Using last published store{" "}
                  <span className="font-mono text-foreground/85">
                    /s/{storeSlug}
                  </span>
                  .
                </>
              ) : null}
            </p>
          </div>
          <Link
            href="/onboard"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted"
          >
            Open a store
          </Link>
        </div>

        {snowtrace ? (
          <p className="text-sm">
            Snowtrace:{" "}
            <a
              className="text-primary underline-offset-4 hover:underline"
              href={snowtrace}
              target="_blank"
              rel="noreferrer"
            >
              {snowtrace}
            </a>
          </p>
        ) : null}

        <section className="flex min-h-[480px] flex-col border border-border bg-background">
          <h2 className="border-b border-border px-4 py-3 text-sm font-medium">
            Buyer agent
          </h2>
          <ScrollArea className="h-72 px-4 py-3">
            <div className="flex flex-col gap-2 font-mono text-xs">
              {buyerLines.map((line, index) => (
                <p key={index} className="whitespace-pre-wrap text-foreground/80">
                  <span className="text-foreground/50">{line.role}: </span>
                  {isUrl(line.text) ? (
                    <a
                      className="text-primary underline-offset-2 hover:underline"
                      href={line.text.trim()}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {line.text.trim()}
                    </a>
                  ) : (
                    line.text
                  )}
                </p>
              ))}
            </div>
          </ScrollArea>
          <form
            onSubmit={runBuyer}
            className="mt-auto flex flex-col gap-2 border-t border-border p-4"
          >
            <Textarea
              value={buyerInput}
              onChange={(event) => setBuyerInput(event.target.value)}
              rows={3}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={busy !== null}>
                Buy via x402
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy !== null}
                onClick={issueCard}
              >
                StraitsX card rail
              </Button>
            </div>
          </form>
        </section>

        <ProtocolLog className="max-w-none" />
      </main>
    </div>
  );
}
