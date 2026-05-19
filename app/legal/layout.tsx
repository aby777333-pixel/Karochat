import Link from "next/link";
import { Logo, Wordmark } from "@/components/Brand";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-5 py-6">
      <header className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Logo className="h-6 w-6" />
          <Wordmark className="text-lg" />
        </Link>
        <nav className="flex gap-3 text-xs text-white/60">
          <Link href="/legal/terms" className="hover:text-white">Terms</Link>
          <Link href="/legal/community" className="hover:text-white">Community</Link>
          <Link href="/legal/privacy" className="hover:text-white">Privacy</Link>
        </nav>
      </header>
      <article className="prose prose-invert mt-8 max-w-none">{children}</article>
      <footer className="mt-12 text-center text-[11px] text-white/30">
        Karochat — be kind, be real.
      </footer>
    </div>
  );
}
