import Link from "next/link";
import { cn } from "@/lib/utils";

export function SiteHeader({ className }: { className?: string }) {
  return (
    <header
      className={cn(
        "absolute inset-x-0 top-0 z-20 h-16 border-b border-border/60 bg-background/80 backdrop-blur-md",
        className,
      )}
    >
      <div className="mx-auto flex h-full max-w-[1400px] items-center justify-between px-6">
        <Link
          href="/"
          className="font-[family-name:var(--font-syne)] text-lg font-extrabold tracking-[-0.04em] text-foreground"
        >
          Aisle
        </Link>
        <nav className="flex items-center gap-5 text-sm text-foreground/65">
          <Link href="/market" className="hover:text-foreground">
            Market
          </Link>
          <Link href="/onboard" className="hover:text-foreground">
            Open a store
          </Link>
          <Link href="/buyer" className="hover:text-foreground">
            Buyer
          </Link>
          <Link href="/demo" className="hidden hover:text-foreground sm:inline">
            Handshake
          </Link>
          <Link
            href="/dashboard"
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Ops
          </Link>
        </nav>
      </div>
    </header>
  );
}
