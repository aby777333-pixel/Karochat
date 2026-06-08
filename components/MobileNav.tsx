"use client";

// Karochat — persistent mobile bottom navigation (Wave 21).
//
// A fixed, thumb-friendly bottom bar shown only on small screens (md:hidden)
// and only when signed in. It gives every page a consistent home for the
// core actions, mirroring modern app shells:
//
//   🏠 Home   🎬 Shorts   [ 🎤 Voice FAB ]   ⚡ Meet   ☰ Menu
//
// The center FAB fires the global "karo:voice" event picked up by
// <VoiceCommand />. The Menu opens a full sheet with every module and
// account action so nothing from the old top header is lost on mobile.
//
// Purely additive: renders null when logged out, never throws, and adds a
// body class so pages can reserve space for the bar (see globals.css).

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { SignOutButton } from "@/components/SignOutButton";

function haptic(ms = 10) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* ignore */
  }
}

type MenuLink = { href: string; label: string; emoji: string; accent: string };

const MENU_LINKS: MenuLink[] = [
  { href: "/books", label: "Books", emoji: "📚", accent: "text-neon-blue" },
  { href: "/read", label: "Read", emoji: "📖", accent: "text-neon-purple" },
  { href: "/write", label: "Write", emoji: "✍️", accent: "text-neon-mint" },
  { href: "/sexed", label: "Sex ed", emoji: "💞", accent: "text-neon-red" },
  { href: "/shorts", label: "Shorts", emoji: "🎬", accent: "text-neon-amber" },
  { href: "/meet/now", label: "Meet now", emoji: "⚡", accent: "text-neon-amber" },
  { href: "/handshake", label: "Handshake", emoji: "🤝", accent: "text-neon-mint" },
  { href: "/charter", label: "Charter", emoji: "🌍", accent: "text-neon-blue" }
];

export function MobileNav() {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const [authed, setAuthed] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // Resolve auth state (and keep it fresh) on the client.
  useEffect(() => {
    let alive = true;
    const supabase = createSupabaseBrowserClient();
    void (async () => {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!alive) return;
      setAuthed(!!user);
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", user.id)
          .maybeSingle();
        if (alive) setUsername((data?.username as string) ?? null);
      }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (alive) setAuthed(!!session?.user);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Reserve space at the bottom of every page while the bar is present.
  useEffect(() => {
    if (authed) {
      document.body.classList.add("has-mobile-nav");
    } else {
      document.body.classList.remove("has-mobile-nav");
    }
    return () => document.body.classList.remove("has-mobile-nav");
  }, [authed]);

  // Close the sheet whenever we navigate.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  if (!authed) return null;

  const isActive = (href: string) =>
    href === "/rooms" ? pathname === "/rooms" : pathname.startsWith(href);

  const profileHref = username ? `/u/${username}` : "/rooms";

  const Item = ({
    href,
    label,
    emoji,
    onClick
  }: {
    href?: string;
    label: string;
    emoji: string;
    onClick?: () => void;
  }) => {
    const active = href ? isActive(href) : false;
    const inner = (
      <>
        <span className="text-[20px] leading-none">{emoji}</span>
        <span className="text-[10px] font-medium leading-none">{label}</span>
      </>
    );
    const cls = clsx(
      "flex flex-1 basis-0 flex-col items-center justify-end gap-1 py-1 transition active:scale-90",
      active ? "text-white" : "text-white/55"
    );
    if (href) {
      return (
        <Link href={href} className={cls} onClick={() => haptic()}>
          {inner}
        </Link>
      );
    }
    return (
      <button type="button" className={cls} onClick={onClick}>
        {inner}
      </button>
    );
  };

  return (
    <>
      <nav
        aria-label="Primary"
        className="mobile-nav fixed inset-x-0 bottom-0 z-40 md:hidden"
      >
        <div className="relative mx-auto flex max-w-md items-end justify-between gap-0.5 border-t border-white/10 bg-ink-900/90 px-1.5 pb-1 pt-2 backdrop-blur-xl">
          <Item href="/rooms" label="Home" emoji="🏠" />
          <Item href="/shorts" label="Shorts" emoji="🎬" />

          {/* Center voice FAB — same flex-1 column as the others so widths
              stay equal; the button just floats above the bar. */}
          <div className="flex flex-1 basis-0 flex-col items-center justify-end gap-1 py-1">
            <button
              type="button"
              aria-label="Voice command"
              onClick={() => {
                haptic(16);
                window.dispatchEvent(new Event("karo:voice"));
              }}
              className="-mt-7 flex h-12 w-12 items-center justify-center rounded-full border-4 border-ink-900 bg-gradient-to-br from-neon-purple via-neon-red to-neon-blue text-xl text-white shadow-glow-blue transition active:scale-90"
            >
              🎤
            </button>
            <span className="text-[10px] font-medium text-white/55">Voice</span>
          </div>

          <Item href="/meet/now" label="Meet" emoji="⚡" />
          <Item label="Menu" emoji="☰" onClick={() => { haptic(); setMenuOpen(true); }} />
        </div>
      </nav>

      {menuOpen && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[85] flex items-end bg-black/70 backdrop-blur-sm md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMenuOpen(false);
          }}
        >
          <div className="surface-glass tint-purple max-h-[82vh] w-full overflow-y-auto rounded-b-none rounded-t-3xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] animate-rise">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" aria-hidden />
            <div className="flex items-center justify-between">
              <p className="font-display text-lg font-semibold text-white">Everything</p>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Close"
                className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/70 hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 grid grid-cols-4 gap-3">
              {MENU_LINKS.map((m) => (
                <Link
                  key={m.href}
                  href={m.href}
                  onClick={() => haptic()}
                  className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/10 bg-white/5 px-1 py-3 text-center transition active:scale-95"
                >
                  <span className={clsx("text-2xl", m.accent)}>{m.emoji}</span>
                  <span className="text-[11px] font-medium text-white/80">{m.label}</span>
                </Link>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                haptic(12);
                window.dispatchEvent(new Event("karo:install"));
              }}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-neon-blue/40 bg-neon-blue/10 px-3 py-2.5 text-sm font-medium text-neon-blue transition hover:bg-neon-blue/20"
            >
              <span aria-hidden>⬇</span> Install app
            </button>

            <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/10 pt-4">
              <Link
                href={profileHref}
                onClick={() => haptic()}
                className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
              >
                <span aria-hidden>👤</span> Profile
              </Link>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    haptic(16);
                    window.dispatchEvent(new Event("karo:voice"));
                  }}
                  className="flex items-center gap-1 rounded-lg border border-neon-purple/40 bg-neon-purple/10 px-3 py-2 text-sm text-neon-purple hover:bg-neon-purple/20"
                >
                  🎤 Voice
                </button>
                <SignOutButton />
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
