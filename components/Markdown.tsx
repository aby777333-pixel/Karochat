// Karochat — minimal article markdown renderer.
//
// Used by the sex-ed library article page. Intentionally tiny — we
// only support the subset we use in seeded articles. Adding
// react-markdown is overkill for this scope.
//
// Supported:
//   • Paragraphs (blank-line separated).
//   • `### Heading 3` and `## Heading 2`.
//   • Bullet lists (`- item`).
//   • Numbered lists (`1. item`).
//   • **bold** and *italic* inline.
//   • `inline code`.
//   • Bare URLs (auto-linked).
//
// Not supported (by design): images, tables, footnotes, blockquotes,
// nested lists, raw HTML. The seed articles don't use these.

import React, { Fragment } from "react";

type Block =
  | { kind: "p"; lines: string[] }
  | { kind: "h2"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] };

function tokenize(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (line.trim() === "") {
      i += 1;
      continue;
    }
    if (line.startsWith("### ")) {
      blocks.push({ kind: "h3", text: line.slice(4).trim() });
      i += 1;
      continue;
    }
    if (line.startsWith("## ")) {
      blocks.push({ kind: "h2", text: line.slice(3).trim() });
      i += 1;
      continue;
    }
    if (/^- /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^- /.test(lines[i] ?? "")) {
        items.push((lines[i] ?? "").slice(2).trim());
        i += 1;
      }
      blocks.push({ kind: "ul", items });
      continue;
    }
    if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i] ?? "")) {
        items.push((lines[i] ?? "").replace(/^\d+\.\s*/, "").trim());
        i += 1;
      }
      blocks.push({ kind: "ol", items });
      continue;
    }
    // Paragraph (one or more consecutive non-empty, non-special lines).
    const para: string[] = [];
    while (
      i < lines.length &&
      (lines[i] ?? "").trim() !== "" &&
      !(lines[i] ?? "").startsWith("#") &&
      !/^- /.test(lines[i] ?? "") &&
      !/^\d+\. /.test(lines[i] ?? "")
    ) {
      para.push((lines[i] ?? "").trim());
      i += 1;
    }
    blocks.push({ kind: "p", lines: para });
  }
  return blocks;
}

// Inline pass: **bold**, *italic*, `code`, autolink URLs.
function renderInline(text: string, keyPrefix = ""): React.ReactNode {
  // Use a sequential parser to keep precedence simple. We pull tokens
  // in priority order: code -> bold -> italic -> autolink. Code is
  // first so its contents aren't re-processed.
  const out: React.ReactNode[] = [];
  let buffer = text;
  let i = 0;
  while (buffer.length > 0) {
    // Match earliest of the three patterns.
    const code = buffer.indexOf("`");
    const bold = buffer.indexOf("**");
    const italic = buffer.search(/(?<![*\w])\*(?!\*)/); // * not ** and not mid-word
    const urlMatch = buffer.match(/https?:\/\/[^\s)]+/);
    const urlIdx = urlMatch && urlMatch.index !== undefined ? urlMatch.index : -1;

    const candidates = [
      { kind: "code", idx: code },
      { kind: "bold", idx: bold },
      { kind: "italic", idx: italic },
      { kind: "url", idx: urlIdx }
    ].filter((c) => c.idx >= 0);

    if (candidates.length === 0) {
      out.push(buffer);
      break;
    }
    candidates.sort((a, b) => a.idx - b.idx);
    const next = candidates[0]!;

    if (next.idx > 0) {
      out.push(buffer.slice(0, next.idx));
    }

    if (next.kind === "code") {
      const rest = buffer.slice(next.idx + 1);
      const close = rest.indexOf("`");
      if (close < 0) {
        out.push(buffer.slice(next.idx));
        break;
      }
      out.push(
        <code
          key={`${keyPrefix}c${i++}`}
          className="rounded bg-white/10 px-1 py-0.5 text-[0.9em] font-mono text-white/90"
        >
          {rest.slice(0, close)}
        </code>
      );
      buffer = rest.slice(close + 1);
    } else if (next.kind === "bold") {
      const rest = buffer.slice(next.idx + 2);
      const close = rest.indexOf("**");
      if (close < 0) {
        out.push(buffer.slice(next.idx));
        break;
      }
      out.push(
        <strong key={`${keyPrefix}b${i++}`} className="font-semibold text-white">
          {renderInline(rest.slice(0, close), `${keyPrefix}b${i}`)}
        </strong>
      );
      buffer = rest.slice(close + 2);
    } else if (next.kind === "italic") {
      const rest = buffer.slice(next.idx + 1);
      const close = rest.search(/\*(?!\*)/);
      if (close < 0) {
        out.push(buffer.slice(next.idx));
        break;
      }
      out.push(
        <em key={`${keyPrefix}i${i++}`} className="italic text-white/90">
          {renderInline(rest.slice(0, close), `${keyPrefix}i${i}`)}
        </em>
      );
      buffer = rest.slice(close + 1);
    } else if (next.kind === "url") {
      const url = urlMatch![0];
      // Trim trailing punctuation like `.` `,` `;` `)` `]`
      const trimmed = url.replace(/[.,;)\]]+$/, "");
      out.push(
        <a
          key={`${keyPrefix}u${i++}`}
          href={trimmed}
          target="_blank"
          rel="noopener noreferrer"
          className="text-neon-blue underline-offset-2 hover:underline"
        >
          {trimmed}
        </a>
      );
      buffer = buffer.slice(next.idx + trimmed.length);
    }
  }
  return <>{out}</>;
}

export function Markdown({ source }: { source: string }) {
  const blocks = tokenize(source);
  return (
    <div className="space-y-4 text-[15px] leading-relaxed text-white/85">
      {blocks.map((b, idx) => {
        if (b.kind === "h2") {
          return (
            <h2
              key={idx}
              className="mt-8 font-display text-xl font-semibold text-white"
            >
              {renderInline(b.text, `h2-${idx}-`)}
            </h2>
          );
        }
        if (b.kind === "h3") {
          return (
            <h3
              key={idx}
              className="mt-6 font-display text-base font-semibold text-white"
            >
              {renderInline(b.text, `h3-${idx}-`)}
            </h3>
          );
        }
        if (b.kind === "ul") {
          return (
            <ul key={idx} className="list-disc space-y-1.5 pl-5">
              {b.items.map((it, j) => (
                <li key={j}>{renderInline(it, `ul-${idx}-${j}-`)}</li>
              ))}
            </ul>
          );
        }
        if (b.kind === "ol") {
          return (
            <ol key={idx} className="list-decimal space-y-1.5 pl-5">
              {b.items.map((it, j) => (
                <li key={j}>{renderInline(it, `ol-${idx}-${j}-`)}</li>
              ))}
            </ol>
          );
        }
        return (
          <p key={idx}>
            {b.lines.map((line, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {renderInline(line, `p-${idx}-${j}-`)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
