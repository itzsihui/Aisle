"use client";

import { FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import type { MerchantDraft } from "@/lib/inventory/parse";

export type ChatLine = {
  role: "merchant" | "aisle";
  text: string;
  llm?: string;
};

export function MerchantChat({
  lines,
  message,
  setMessage,
  busy,
  onSubmit,
  onFile,
  belowMessages,
}: {
  lines: ChatLine[];
  message: string;
  setMessage: (value: string) => void;
  busy: boolean;
  onSubmit: (event: FormEvent) => void;
  onFile: (file: File) => void;
  belowMessages?: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <ScrollArea className="min-h-0 flex-1 px-4 py-4">
        <div className="flex flex-col gap-4">
          {lines.map((line, index) => (
            <p key={index} className="text-sm leading-relaxed">
              <span className="font-medium text-foreground">
                {line.role === "aisle" ? "aisle" : "you"}:
              </span>{" "}
              <span className="text-foreground/80">{line.text}</span>
              {line.llm ? (
                <span className="text-foreground/45"> · {line.llm}</span>
              ) : null}
            </p>
          ))}
        </div>
      </ScrollArea>
      {belowMessages}
      <form
        onSubmit={onSubmit}
        className="shrink-0 border-t border-border bg-background/90 p-4"
      >
        <Textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder='e.g. "clothing store: 5 shirts, 5 jeans, 10 socks"'
          rows={3}
          className="resize-none"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={busy || !message.trim()}>
            {busy ? "Working…" : "Send"}
          </Button>
          <Input
            type="file"
            accept=".csv,.txt,.tsv"
            className="max-w-[220px]"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onFile(file);
            }}
          />
        </div>
      </form>
    </div>
  );
}

export function PriceDraftForm({
  draft,
  prices,
  setPrices,
  busy,
  onSubmit,
}: {
  draft: MerchantDraft;
  prices: string[];
  setPrices: (prices: string[]) => void;
  busy: boolean;
  onSubmit: () => void;
}) {
  return (
    <div className="shrink-0 border-t border-border bg-muted/40 px-4 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-foreground/55">
        Set {draft.lines.length === 1 ? "price" : "prices"} (XSGD)
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {draft.lines.map((line, index) => (
          <div
            key={`${line.title}-${index}`}
            className="grid grid-cols-[1fr_7rem] items-center gap-3"
          >
            <p className="text-sm text-foreground/85">
              <span className="font-medium">{line.quantity}</span> {line.title}
            </p>
            <Input
              inputMode="decimal"
              placeholder="0.00"
              value={prices[index] ?? ""}
              onChange={(event) => {
                const next = [...prices];
                next[index] = event.target.value;
                setPrices(next);
              }}
              aria-label={`Price for ${line.title}`}
            />
          </div>
        ))}
      </div>
      <Button
        type="button"
        className="mt-3"
        disabled={busy || prices.some((p) => !String(p).trim())}
        onClick={onSubmit}
      >
        {busy ? "Publishing…" : "Submit prices"}
      </Button>
    </div>
  );
}
