// Karochat — content / upload-download disclaimer.
//
// One reusable, server-safe component (no client JS). `scope` picks the wording:
//   • "general" — site-wide notice (use in the lobby / footer).
//   • "files"   — for the Files & Apps download hub.
//   • "media"   — for media wall uploads (adult, audiobooks, etc.).
// Karochat is a platform; user content is the user's responsibility.

import Link from "next/link";

type Scope = "general" | "files" | "media";

const TEXT: Record<Scope, { title: string; body: string }> = {
  general: {
    title: "A note on user content",
    body:
      "Karochat is a community platform. Posts, files, links and streams here are uploaded, shared and posted by users — not by Karochat. We do not create, own the rights to, endorse, verify, scan or take responsibility for any user content, including any files you upload or download. You are solely responsible for what you upload (you must own it or have the right to share it) and for anything you download, open or install — do so entirely at your own risk and scan files before opening them. Illegal, infringing or harmful content is prohibited and is removed when reported."
  },
  files: {
    title: "Download & upload disclaimer",
    body:
      "Files here are uploaded by users. Karochat does not host the rights to, scan, vet or take any responsibility for any uploaded or downloaded file. Download, open and install entirely at your own risk — always scan files with up-to-date antivirus first, and never run software you don't trust. Only upload files you own or have the right to share. No malware, pirated, copyrighted, illegal or harmful files — these are removed when reported and may lead to a ban."
  },
  media: {
    title: "Upload & download disclaimer",
    body:
      "This content is uploaded and shared by users. Karochat does not host the rights to, vet or take responsibility for any uploaded or downloaded media or links. Share only your own content or content you have the right to share, and view, download or open anything here at your own risk. Illegal, non-consensual or infringing content is prohibited and removed when reported."
  }
};

export function ContentDisclaimer({
  scope = "general",
  className = ""
}: {
  scope?: Scope;
  className?: string;
}) {
  const t = TEXT[scope];
  return (
    <div
      className={
        "rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-[10px] leading-relaxed text-white/40 " +
        className
      }
    >
      <span className="font-semibold uppercase tracking-widest text-white/55">⚠ {t.title}</span>
      <p className="mt-1">{t.body}</p>
      <p className="mt-1">
        By using Karochat you agree to our{" "}
        <Link href="/legal/terms" className="text-white/55 underline-offset-2 hover:underline">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/legal/community" className="text-white/55 underline-offset-2 hover:underline">
          Community Guidelines
        </Link>
        .
      </p>
    </div>
  );
}
