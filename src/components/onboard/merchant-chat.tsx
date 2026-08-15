"use client";

import { FormEvent, useRef, type ReactNode } from "react";
import { Paperclip, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import type { MerchantDraft } from "@/lib/inventory/parse";
import { shortAddress } from "@/lib/wallet/ethereum";

export type ChatLine = {
  role: "merchant" | "aisle";
  text: string;
  llm?: string;
};

export type StarterAction = "describe" | "import" | "url" | "wallet";

export function MerchantChat({
  lines,
  message,
  setMessage,
  busy,
  onSubmit,
  onFile,
  storeUrl,
  setStoreUrl,
  onImportUrl,
  belowMessages,
  merchantAddress,
  walletAuthenticated,
  onConnectWallet,
  onStarter,
  showStarterActions,
}: {
  lines: ChatLine[];
  message: string;
  setMessage: (value: string) => void;
  busy: boolean;
  onSubmit: (event: FormEvent) => void;
  onFile: (file: File) => void;
  storeUrl?: string;
  setStoreUrl?: (value: string) => void;
  onImportUrl?: () => void;
  belowMessages?: ReactNode;
  merchantAddress?: string | null;
  walletAuthenticated?: boolean;
  onConnectWallet?: () => void;
  onStarter?: (action: StarterAction) => void;
  showStarterActions?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <p className="text-xs text-foreground/55">Merchant setup</p>
        <div className="flex items-center gap-2">
          {walletAuthenticated && merchantAddress ? (
            <span
              className="rounded-md border border-border bg-muted/50 px-2 py-1 font-mono text-[11px] text-foreground/80"
              title={merchantAddress}
            >
              {shortAddress(merchantAddress)} · Fuji
            </span>
          ) : null}
          <Button
            type="button"
            variant={walletAuthenticated ? "outline" : "default"}
            size="sm"
            disabled={busy}
            onClick={onConnectWallet}
            className="h-8 gap-1.5 text-xs"
          >
            <Wallet className="size-3.5" />
            {walletAuthenticated ? "Re-auth MetaMask" : "Sign in with MetaMask"}
          </Button>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1 px-4 py-4">
        <div className="flex flex-col gap-4">
          {lines.map((line, index) => (
            <div key={index} className="text-sm leading-relaxed">
              <p className="whitespace-pre-wrap">
                <span className="font-medium text-foreground">
                  {line.role === "aisle" ? "aisle" : "you"}:
                </span>{" "}
                <span className="text-foreground/80">{line.text}</span>
                {line.llm ? (
                  <span className="text-foreground/45"> · {line.llm}</span>
                ) : null}
              </p>
              {showStarterActions && index === 0 && line.role === "aisle" ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    className="h-8 text-xs"
                    onClick={() => onStarter?.("describe")}
                  >
                    Add product
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    className="h-8 text-xs"
                    onClick={() => {
                      onStarter?.("import");
                      fileRef.current?.click();
                    }}
                  >
                    Import CSV
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    className="h-8 text-xs"
                    onClick={() => onStarter?.("url")}
                  >
                    Store URL
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    className="h-8 text-xs"
                    onClick={() => onStarter?.("wallet")}
                  >
                    Connect MetaMask
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </ScrollArea>
      {belowMessages}
      <form
        onSubmit={onSubmit}
        className="shrink-0 border-t border-border bg-background/90 p-4"
      >
        {!walletAuthenticated ? (
          <div className="mb-3 flex flex-col gap-2 rounded-md border border-dashed border-border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-foreground/55">
              Sign in with MetaMask to set your x402 payout address (Avalanche
              Fuji). You&apos;ll approve connect, then sign a message — no
              funds move.
            </p>
            <Button
              type="button"
              size="sm"
              disabled={busy}
              className="shrink-0"
              onClick={onConnectWallet}
            >
              <Wallet className="size-3.5" />
              Sign in with MetaMask
            </Button>
          </div>
        ) : null}
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={storeUrl ?? ""}
            onChange={(event) => setStoreUrl?.(event.target.value)}
            placeholder="Shopify store URL… e.g. your-store.myshopify.com"
            disabled={busy}
            className="text-xs"
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              if ((storeUrl ?? "").trim()) onImportUrl?.();
            }}
          />
          <Button
            type="button"
            variant="outline"
            disabled={busy || !(storeUrl ?? "").trim()}
            className="shrink-0"
            onClick={() => onImportUrl?.()}
          >
            Import URL
          </Button>
        </div>
        <Textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Ask anything… e.g. phone store with 5 iPhones and 5 Samsungs"
          rows={3}
          className="resize-none"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={busy || !message.trim()}>
            {busy ? "Working…" : "Send"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={busy}
            className="size-9"
            aria-label="Attach CSV"
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip className="size-4" />
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt,.tsv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onFile(file);
              event.target.value = "";
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
  quantities,
  setQuantities,
  busy,
  onSubmit,
  walletReady,
}: {
  draft: MerchantDraft;
  prices: string[];
  setPrices: (prices: string[]) => void;
  quantities: string[];
  setQuantities: (quantities: string[]) => void;
  busy: boolean;
  onSubmit: () => void;
  walletReady?: boolean;
}) {
  const allPriced = draft.lines.every((_, i) => String(prices[i] ?? "").trim());
  const allQtyOk = draft.lines.every((_, i) => {
    const q = Number(String(quantities[i] ?? "").trim());
    return Number.isFinite(q) && q > 0;
  });
  const hasSuggestions = draft.lines.some((line) => Boolean(line.price));
  return (
    <div className="shrink-0 border-t border-border bg-muted/40 px-4 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-foreground/55">
        {hasSuggestions
          ? `Confirm or edit qty + ${draft.lines.length === 1 ? "price" : "prices"} (XSGD)`
          : `Set qty + ${draft.lines.length === 1 ? "price" : "prices"} (XSGD)`}
      </p>
      {!walletReady ? (
        <p className="mt-1 text-xs text-foreground/50">
          Sign in with MetaMask before publishing — we verify ownership via a
          signature (Avalanche Fuji).
        </p>
      ) : null}
      <div className="mt-3 flex flex-col gap-2">
        {draft.lines.map((line, index) => (
          <div
            key={`${line.title}-${index}`}
            className="grid grid-cols-[4.5rem_1fr_7rem] items-center gap-3"
          >
            <Input
              inputMode="numeric"
              placeholder="100"
              value={quantities[index] ?? ""}
              onChange={(event) => {
                const next = [...quantities];
                next[index] = event.target.value;
                setQuantities(next);
              }}
              aria-label={`Quantity for ${line.title}`}
            />
            <p className="truncate text-sm text-foreground/85" title={line.title}>
              {line.title}
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
        disabled={busy || !allPriced || !allQtyOk}
        onClick={onSubmit}
      >
        {busy
          ? walletReady
            ? "Publishing…"
            : "Opening MetaMask…"
          : walletReady
            ? hasSuggestions
              ? "Confirm & publish"
              : "Submit prices"
            : "Sign in with MetaMask & publish"}
      </Button>
    </div>
  );
}
