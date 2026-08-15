import Link from "next/link";
import { Terminal } from "@/components/ui/terminal";
import { SiteHeader } from "@/components/site-header";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Home() {
  return (
    <div className="aisle-grid relative min-h-[100dvh]">
      <SiteHeader />
      <main className="mx-auto grid min-h-[100dvh] max-w-[1400px] grid-cols-1 items-end gap-10 px-6 pb-16 pt-24 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="text-5xl font-semibold tracking-tight md:text-6xl">Aisle</p>
          <h1 className="mt-6 max-w-[18ch] text-3xl font-medium tracking-tight md:text-4xl">
            Agents are first-class customers.
          </h1>
          <p className="mt-4 max-w-[36ch] text-base leading-relaxed text-foreground/70">
            Spin up an AI-native storefront in minutes. Agents discover via llms.txt and pay in XSGD.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/onboard"
              className={cn(buttonVariants({ size: "lg" }), "h-10 px-4")}
            >
              Open a store
            </Link>
            <Link
              href="/demo"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-10 px-4")}
            >
              Watch the handshake
            </Link>
          </div>
        </div>
        <Terminal
          className="max-w-none px-0"
          username="aisle"
          enableSound={false}
          typingSpeed={28}
          commands={[
            "curl -i /s/hackathon-shirts/llms.txt",
            "curl -i -X POST /s/hackathon-shirts/buy",
            "curl -i -H 'PAYMENT-SIGNATURE: 0x…' -X POST /buy",
          ]}
          outputs={{
            0: ["# StraitsX Hackathon Shirts", "Catalog: /s/hackathon-shirts/catalog.json"],
            1: ["HTTP/1.1 402 Payment Required", "PAYMENT-REQUIRED: XSGD on Avalanche"],
            2: ["HTTP/1.1 200 OK", "receipt unlocked · snowtrace.io/tx/0x…"],
          }}
        />
        <p className="col-span-full text-xs text-foreground/50 lg:col-span-2">
          Avalanche x402 · StraitsX cards · AWS Bedrock + Well-Architected protocol
        </p>
      </main>
    </div>
  );
}
