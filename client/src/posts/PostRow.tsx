import type { ReactNode } from "react";
import { Clock3, Images, Rocket } from "lucide-react";
import { PlatformIcon, StatusBadge, formatDate } from "../components/shared";
import type { PostRecord } from "../types";

export function PostRow({ post, actions }: { post: PostRecord; actions?: ReactNode }) {
  const cover = post.media[0];
  return (
    <article className="post-row">
      <div className="post-thumb">
        {cover?.kind === "image"
          ? <img src={cover.url} alt="" loading="lazy" />
          : cover?.kind === "video"
            ? <span><Rocket size={20} /></span>
            : <span><Rocket size={20} /></span>}
        {post.media.length > 1 && <span className="post-thumb-count"><Images size={11} /> {post.media.length}</span>}
      </div>
      <div className="post-primary">
        <div className="post-title-line">
          <h3>{post.base.title || "بدون عنوان"}</h3>
          <StatusBadge status={post.status} />
        </div>
        <div className="post-meta"><Clock3 size={14} /> {formatDate(post.scheduledAt ?? post.createdAt)}</div>
      </div>
      <div className="post-platforms" aria-label="منصات النشر">
        {post.platforms.map((platform) => <PlatformIcon platform={platform} size="small" key={platform} />)}
      </div>
      {actions}
    </article>
  );
}
