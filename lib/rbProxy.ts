// Karochat — shared server-side radio-browser proxy core.
//
// Used by the /api/rb route handlers. Fetches radio-browser server-to-server
// across several mirrors with a short retry (the de1 mirror periodically replies
// "no available server" as plain text, which we treat as a miss and move on).
// Returns the parsed station array, or null if every mirror failed.

const MIRRORS = [
  "https://de2.api.radio-browser.info",
  "https://all.api.radio-browser.info",
  "https://de1.api.radio-browser.info",
  "https://nl1.api.radio-browser.info",
  "https://at1.api.radio-browser.info"
];

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Decode a base64url-encoded radio-browser path ("/json/...?tag=x&limit=y").
// base64url uses only [A-Za-z0-9_-], so the nested "?"/"&" survive any URL layer.
export function decodeRbPath(q: string): string {
  try {
    const b64 = q.replace(/-/g, "+").replace(/_/g, "/");
    return Buffer.from(b64, "base64").toString("utf8");
  } catch {
    return "";
  }
}

export async function tryMirrors(path: string): Promise<any[] | null> {
  for (let i = 0; i < MIRRORS.length; i++) {
    try {
      const res = await fetch(MIRRORS[i] + path, {
        cache: "no-store",
        headers: { "user-agent": "Karochat/1.0 (+https://magical-heliotrope-e4d7df.netlify.app)" }
      });
      if (res.ok) {
        const text = await res.text();
        try {
          const data = JSON.parse(text);
          // A healthy response is a JSON array; "no available server" is text.
          if (Array.isArray(data)) return data;
        } catch {
          // non-JSON → try the next mirror
        }
      }
    } catch {
      // network error → try the next mirror
    }
    if (i < MIRRORS.length - 1) await sleep(350);
  }
  return null;
}
