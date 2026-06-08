import Link from "next/link";
import type { Metadata } from "next";
import { Logo, Wordmark } from "@/components/Brand";

export const metadata: Metadata = {
  title: "The People's Charter · Karochat",
  description:
    "Karochat is for people. All of them. The only four lines we won't cross — and why everything else is wide open.",
  openGraph: {
    title: "The People's Charter · Karochat",
    description:
      "Karochat is for people. All of them. The only four lines we won't cross — and why everything else is wide open.",
    type: "website"
  }
};

export default function CharterPage() {
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-2xl flex-col px-5 py-8">
      <header className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Logo className="h-7 w-7" />
          <Wordmark className="text-lg" />
        </Link>
        <Link
          href="/rooms"
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10 hover:text-white"
        >
          ← Rooms
        </Link>
      </header>

      <section className="surface-glass tint-mint mt-8 p-7 sm:p-9">
        <p className="text-[11px] uppercase tracking-widest text-neon-mint">
          The People&apos;s Charter
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-white sm:text-4xl">
          Karochat is for people.
          <br />
          All of them.
        </h1>

        <div className="mt-7 space-y-4 text-base leading-relaxed text-white/85">
          <p>
            Adults can talk like adults here. Be flirty, be horny, be queer, be
            loud, be quiet, be lonely, be in love. Meet someone. Mate. Make
            friends. Lose touch. Come back. It&apos;s your life.
          </p>
          <p>
            We don&apos;t moderate vibes. We don&apos;t read your messages. We
            don&apos;t run word filters on what you say to each other. We
            don&apos;t decide who you can love or what you can want.
          </p>
          <p>
            We have only four lines we won&apos;t cross, because crossing them
            would hurt people who can&apos;t defend themselves:
          </p>
        </div>

        <ul className="mt-6 space-y-3">
          <CharterLine emoji="🚫" title="Nothing involving minors.">
            Adults only on adult surfaces. Anyone targeting minors is reported
            and banned permanently.
          </CharterLine>
          <CharterLine
            emoji="🚫"
            title="No sharing intimate images of someone without their consent."
          >
            Including deepfakes of real people. We take these down within 24 hours.
          </CharterLine>
          <CharterLine
            emoji="🚫"
            title="No calls for violence, no terrorism, no organized hate."
          >
            Disagree all you want. Don&apos;t organize harm.
          </CharterLine>
          <CharterLine emoji="🚫" title="No doxxing.">
            Posting someone&apos;s real identity without their consent —
            addresses, workplaces, faces — gets removed. The anonymity of this
            platform protects you and them.
          </CharterLine>
        </ul>

        <div className="mt-7 space-y-4 text-base leading-relaxed text-white/85">
          <p>
            Beyond that — live and let live. If something here isn&apos;t for
            you, scroll past it. If someone here isn&apos;t for you, block
            them. We&apos;ve made both easy.
          </p>
          <p>
            Be kind when you can. Be real when you can&apos;t. Don&apos;t be
            cruel for sport.
          </p>
          <p className="text-sm text-white/55">— the Karochat team</p>
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          <Link
            href="/rooms/00000000-0000-0000-0000-00000000aaaa"
            className="rounded-xl bg-neon-blue px-5 py-2.5 text-sm font-medium text-ink-900 shadow-glow-blue hover:bg-neon-blue/90"
          >
            Enter the lobby →
          </Link>
          <Link
            href="/legal/terms"
            className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm text-white/80 hover:bg-white/10"
          >
            Read the Terms
          </Link>
        </div>
      </section>

      <footer className="mt-8 space-y-1 text-center text-[11px] text-white/30">
        <p>Be kind. Be real. Live and let live.</p>
        <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          <a href="mailto:info@karochat.co" className="hover:text-white">
            info@karochat.co
          </a>
          <span aria-hidden>·</span>
          <a
            href="mailto:ads@karochat.co?subject=Advertise%20on%20Karochat"
            className="hover:text-white"
            title="Sponsor a room or place a creative in our rails"
          >
            📣 Advertise
          </a>
        </p>
      </footer>
    </main>
  );
}

function CharterLine({
  emoji,
  title,
  children
}: {
  emoji: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/25 px-4 py-3">
      <span aria-hidden className="shrink-0 pt-0.5 text-lg">
        {emoji}
      </span>
      <div className="min-w-0">
        <p className="font-medium text-white">{title}</p>
        <p className="mt-1 text-sm leading-relaxed text-white/70">{children}</p>
      </div>
    </li>
  );
}
