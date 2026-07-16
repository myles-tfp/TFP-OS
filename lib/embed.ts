/**
 * Turn a pasted video URL into an embeddable player URL.
 * Returns null if the URL isn't a known embeddable service.
 */
export function toEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");

    // YouTube: watch?v=, youtu.be/, shorts/
    if (host === "youtube.com" || host === "m.youtube.com") {
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}`;
      const shorts = u.pathname.match(/^\/shorts\/([\w-]+)/);
      if (shorts) return `https://www.youtube.com/embed/${shorts[1]}`;
      const embed = u.pathname.match(/^\/embed\/([\w-]+)/);
      if (embed) return url;
    }
    if (host === "youtu.be") {
      const id = u.pathname.slice(1).split("/")[0];
      if (id) return `https://www.youtube.com/embed/${id}`;
    }

    // Vimeo
    if (host === "vimeo.com") {
      const id = u.pathname.match(/^\/(\d+)/);
      if (id) return `https://player.vimeo.com/video/${id[1]}`;
    }
    if (host === "player.vimeo.com") return url;

    // Loom
    if (host === "loom.com" || host === "www.loom.com") {
      const id = u.pathname.match(/^\/share\/([\w]+)/);
      if (id) return `https://www.loom.com/embed/${id[1]}`;
    }

    return null;
  } catch {
    return null;
  }
}
