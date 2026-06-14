// Karochat — helpers for embedding long-form videos from other sites.
//
// `toVideoEmbed` turns a watch URL from a common video site into an
// iframe-embeddable player URL (so "connect with other video sites" works
// inline). Returns null when no safe embed is known — callers then fall back to
// a plain link-out. `isDirectVideo` detects a direct video file URL that an
// HTML <video> element can play natively.

export function toVideoEmbed(url: string): string | null {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    const host = u.hostname.replace(/^www\./, "");

    // YouTube
    if (host === "youtu.be") {
      const id = u.pathname.slice(1).split("/")[0];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}`;
      const m = u.pathname.match(/\/(embed|shorts|live|v)\/([^/?]+)/);
      if (m && m[2]) return `https://www.youtube.com/embed/${m[2]}`;
    }

    // Vimeo
    if (host.endsWith("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean)[0];
      if (id && /^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}`;
    }

    // Dailymotion
    if (host.endsWith("dailymotion.com")) {
      const m = u.pathname.match(/\/video\/([^_/?]+)/);
      if (m && m[1]) return `https://www.dailymotion.com/embed/video/${m[1]}`;
    }
    if (host === "dai.ly") {
      const id = u.pathname.slice(1).split("/")[0];
      if (id) return `https://www.dailymotion.com/embed/video/${id}`;
    }

    // Facebook
    if (host.endsWith("facebook.com") || host === "fb.watch") {
      return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(
        u.href
      )}&show_text=false`;
    }
  } catch {
    // not a parseable URL
  }
  return null;
}

export function isDirectVideo(url: string): boolean {
  return /\.(mp4|webm|ogg|ogv|mov|m4v|mkv)(\?|#|$)/i.test(url);
}
