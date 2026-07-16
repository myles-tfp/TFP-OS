import { timeAgo } from "@/lib/format";
import { SaveButton } from "@/components/save-button";

const TYPE_ICONS: Record<string, string> = {
  doc: "📄",
  sheet: "📊",
  slides: "🖥️",
  pdf: "📕",
  video: "🎬",
  image: "🖼️",
  canva: "🎨",
  link: "🔗",
};

const TYPE_LABELS: Record<string, string> = {
  doc: "Doc",
  sheet: "Sheet",
  slides: "Slides",
  pdf: "PDF",
  video: "Video",
  image: "Image",
  canva: "Canva",
  link: "Link",
};

export type Resource = {
  id: string;
  title: string;
  type: string;
  url: string;
  updated_at: string;
  topics: { name: string } | null;
};

export function ResourceRow({
  resource,
  showCategory = true,
  meId,
  saved,
}: {
  resource: Resource;
  showCategory?: boolean;
  meId?: string;
  saved?: boolean;
}) {
  return (
    <a className="res" href={resource.url} target="_blank" rel="noreferrer">
      <div className="res-icon">{TYPE_ICONS[resource.type] ?? "🔗"}</div>
      <div>
        <div className="t">{resource.title}</div>
        <div className="m">
          Updated {timeAgo(resource.updated_at)} ·{" "}
          {TYPE_LABELS[resource.type] ?? "Link"}
        </div>
      </div>
      {showCategory && resource.topics && (
        <span className="cat-pill">{resource.topics.name}</span>
      )}
      {meId && (
        <SaveButton
          meId={meId}
          resourceId={resource.id}
          saved={!!saved}
          className="res-save"
        />
      )}
    </a>
  );
}
