import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  return (
    <header className="absolute inset-x-0 top-0 z-20 h-16">
      <div className="mx-auto flex h-full max-w-[1400px] items-center justify-between px-6">
        <Link href="/" className="text-[15px] font-semibold tracking-tight">
          Aisle
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/onboard" className="text-foreground/70 hover:text-foreground">
            Open a store
          </Link>
          <Link href="/buyer" className="text-foreground/70 hover:text-foreground">
            Buyer
          </Link>
          <Link href="/demo" className="text-foreground/70 hover:text-foreground">
            Handshake
          </Link>
          <Link
            href="/dashboard"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Ops
          </Link>
        </nav>
      </div>
    </header>
  );
}
