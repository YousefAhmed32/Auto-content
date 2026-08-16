import { AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import { resolvedMediaFor } from "./PlatformMediaPicker";
import { PlatformIcon, platformMeta } from "../components/shared";
import type { Connection, Platform, PlatformOverride, PostRecord, ValidationIssue } from "../types";

function resolveContent(post: PostRecord, override?: PlatformOverride) {
  if (override?.useCustomContent) {
    return {
      title: override.title ?? post.base.title,
      caption: override.caption ?? post.base.caption,
      hashtags: override.hashtags ?? post.base.hashtags
    };
  }
  return { title: post.base.title, caption: post.base.caption, hashtags: post.base.hashtags };
}

export function PlatformPreviewCard({ platform, post, connection, issues }: {
  platform: Platform;
  post: PostRecord;
  connection?: Connection;
  issues: ValidationIssue[];
}) {
  const override = post.overrides[platform];
  const { caption, hashtags } = resolveContent(post, override);
  const media = resolvedMediaFor(post.media, override?.mediaOrder);
  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warning");
  const state = errors.length ? "error" : warnings.length ? "warning" : "ready";

  return (
    <article className={`preview-card state-${state}`}>
      <header className="preview-card-head">
        <PlatformIcon platform={platform} />
        <div>
          <strong>{platformMeta[platform].name}</strong>
          <small>{connection?.connected ? connection.accountName : "غير متصل بعد"}</small>
        </div>
        <span className={`preview-state preview-state-${state}`}>
          {state === "ready" ? <CheckCircle2 size={15} /> : state === "warning" ? <AlertTriangle size={15} /> : <AlertCircle size={15} />}
          {state === "ready" ? "جاهز" : state === "warning" ? "تنبيه" : "يحتاج تعديل"}
        </span>
      </header>

      <div className="preview-media">
        {media.length ? (
          media[0]!.kind === "image"
            ? <img src={media[0]!.url} alt="" />
            : <video src={media[0]!.url} muted preload="metadata" />
        ) : <div className="preview-media-empty">لا توجد وسائط</div>}
        {media.length > 1 && <span className="preview-media-count">1 / {media.length}</span>}
      </div>

      <p className="preview-caption">
        {caption || <em>بدون نص</em>}
        {hashtags.length > 0 && <span className="preview-hashtags"> {hashtags.map((tag) => `#${tag}`).join(" ")}</span>}
      </p>

      {(errors.length > 0 || warnings.length > 0) && (
        <ul className="validation-list compact">
          {errors.map((issue, index) => <li className="error" key={`e-${index}`}>{issue.message}</li>)}
          {warnings.map((issue, index) => <li className="warning" key={`w-${index}`}>{issue.message}</li>)}
        </ul>
      )}
    </article>
  );
}
