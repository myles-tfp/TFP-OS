/* Renders a post's media inline: uploaded image/video, embedded player, or link box. */
export function PostMedia({
  url,
  type,
}: {
  url: string;
  type: string | null;
}) {
  if (type === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        style={{
          maxWidth: "100%",
          borderRadius: 10,
          border: "1px solid var(--line)",
          marginBottom: 12,
          display: "block",
        }}
      />
    );
  }

  if (type === "video") {
    return (
      <video
        src={url}
        controls
        preload="metadata"
        style={{
          width: "100%",
          borderRadius: 10,
          border: "1px solid var(--line)",
          marginBottom: 12,
          display: "block",
          background: "#000",
        }}
      />
    );
  }

  if (type === "embed") {
    return (
      <div
        style={{
          position: "relative",
          paddingBottom: "56.25%",
          borderRadius: 10,
          overflow: "hidden",
          border: "1px solid var(--line)",
          marginBottom: 12,
        }}
      >
        <iframe
          src={url}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            border: 0,
          }}
        />
      </div>
    );
  }

  return (
    <a
      className="post-media"
      href={url}
      target="_blank"
      rel="noreferrer"
      style={{ textDecoration: "none" }}
    >
      🔗&nbsp; Open attached link
    </a>
  );
}
