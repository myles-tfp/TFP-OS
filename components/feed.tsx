import { Reactions } from "@/components/reactions";
import { PostMedia } from "@/components/post-media";
import { timeAgo } from "@/lib/format";

export type FeedPost = {
  id: string;
  title: string | null;
  body: string;
  media_url: string | null;
  media_type: string | null;
  requires_action: boolean;
  created_at: string;
  topics: { name: string } | null;
  reactions: { franchisee_id: string; emoji: string }[];
};

export function Feed({
  posts,
  meId,
  rosterCount,
}: {
  posts: FeedPost[];
  meId: string;
  rosterCount: number;
}) {
  if (posts.length === 0) {
    return (
      <p className="panel-note">
        Nothing here yet — updates from HQ will land in this feed.
      </p>
    );
  }

  return (
    <>
      {posts.map((post) => {
        const counts: Record<string, number> = {};
        const readers = new Set<string>();
        const mine: string[] = [];
        for (const r of post.reactions) {
          counts[r.emoji] = (counts[r.emoji] ?? 0) + 1;
          readers.add(r.franchisee_id);
          if (r.franchisee_id === meId) mine.push(r.emoji);
        }

        return (
          <article className="post" key={post.id}>
            <div className="post-meta">
              <div className="avatar">TFP</div>
              <div>
                <div className="name">
                  TFP HQ{post.topics ? ` · ${post.topics.name}` : ""}
                </div>
                <div className="time">{timeAgo(post.created_at)}</div>
              </div>
              {post.requires_action && <span className="tag">Action needed</span>}
            </div>
            {post.title && (
              <p
                className="post-body"
                style={{ fontWeight: 500, color: "var(--baseline)", marginBottom: 4 }}
              >
                {post.title}
              </p>
            )}
            <p className="post-body">{post.body}</p>
            {post.media_url && (
              <PostMedia url={post.media_url} type={post.media_type} />
            )}
            <Reactions
              postId={post.id}
              counts={counts}
              mine={mine}
              readCount={readers.size}
              rosterCount={rosterCount}
            />
          </article>
        );
      })}
    </>
  );
}
