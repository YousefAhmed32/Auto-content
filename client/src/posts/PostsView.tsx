import { useState } from "react";
import { History, LoaderCircle, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { api } from "../api";
import { EmptyState, PageHeader, PlatformIcon, PlatformResultBadge, platformMeta } from "../components/shared";
import type { Platform, PostRecord } from "../types";
import { PostRow } from "./PostRow";

function PostDetails({ post, busyPlatform, onRetryPlatform }: {
  post: PostRecord;
  busyPlatform: Platform | null;
  onRetryPlatform: (platform: Platform) => void;
}) {
  return (
    <div className="post-platform-results">
      {post.platforms.map((platform) => {
        const result = post.platformResults[platform];
        const canRetry = result?.status === "failed";
        return (
          <div className="platform-result-row" key={platform}>
            <PlatformIcon platform={platform} size="small" />
            <span className="platform-result-name">{platformMeta[platform].name}</span>
            <PlatformResultBadge status={result?.status ?? "pending"} />
            {result?.message && result.status === "failed" && <span className="platform-result-message" title={result.message}>{result.message}</span>}
            {result?.url && result.status === "published" && (
              <a href={result.url} target="_blank" rel="noreferrer" className="platform-result-link">فتح المنشور</a>
            )}
            {canRetry && (
              <button
                type="button"
                className="icon-button"
                disabled={busyPlatform === platform}
                aria-label={`إعادة محاولة النشر على ${platformMeta[platform].name}`}
                onClick={() => onRetryPlatform(platform)}
              >
                {busyPlatform === platform ? <LoaderCircle className="spin" size={15} /> : <RefreshCw size={15} />}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function PostsView({ posts, loading, refresh, notify, onEditDraft }: {
  posts: PostRecord[];
  loading: boolean;
  refresh: () => Promise<void>;
  notify: (message: string, type?: "success" | "error") => void;
  onEditDraft: (id: string) => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyPlatform, setBusyPlatform] = useState<Platform | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function retryAll(id: string) {
    setBusyId(id);
    try { await api.publish(id); notify("اكتملت محاولة إعادة النشر"); await refresh(); }
    catch (error) { notify(error instanceof Error ? error.message : "تعذر إعادة النشر", "error"); }
    finally { setBusyId(null); }
  }

  async function retryPlatform(id: string, platform: Platform) {
    setBusyId(id);
    setBusyPlatform(platform);
    try { await api.publishPlatform(id, platform); notify(`أُعيدت محاولة النشر على ${platformMeta[platform].name}`); await refresh(); }
    catch (error) { notify(error instanceof Error ? error.message : "تعذر إعادة النشر", "error"); }
    finally { setBusyId(null); setBusyPlatform(null); }
  }

  async function remove(id: string) {
    if (!window.confirm("هل تريد حذف هذا المحتوى وسجله؟")) return;
    setBusyId(id);
    try { await api.deletePost(id); notify("تم حذف المحتوى"); await refresh(); }
    catch (error) { notify(error instanceof Error ? error.message : "تعذر الحذف", "error"); }
    finally { setBusyId(null); }
  }

  return (
    <div className="view-stack">
      <PageHeader
        eyebrow="السجل التشغيلي"
        title="كل منشور وحالته."
        copy="راجع ما نُشر، ما ينتظر موعده، وما يحتاج تدخلًا منك - لكل منصة نتيجتها المستقلة."
        action={<button className="secondary-button" onClick={() => void refresh()}><RefreshCw size={17} /> تحديث</button>}
      />
      <section className="panel posts-panel">
        <div className="panel-heading"><div><span className="section-kicker">المحتوى</span><h2>{posts.length.toLocaleString("ar-EG")} منشور</h2></div></div>
        {loading ? <div className="post-skeletons"><span /><span /><span /><span /></div> : posts.length ? (
          <div className="post-list full-list">
            {posts.map((post) => {
              const expanded = expandedId === post.id;
              const canRetryAny = post.status === "failed" || post.status === "partial";
              return (
                <div className="post-row-wrap" key={post.id}>
                  <PostRow
                    post={post}
                    actions={
                      <div className="row-actions">
                        {(post.status === "draft" || post.status === "scheduled") && (
                          <button type="button" className="icon-button" aria-label="متابعة التحرير" onClick={() => onEditDraft(post.id)}>
                            <Pencil size={17} />
                          </button>
                        )}
                        <button type="button" className="text-button" onClick={() => setExpandedId(expanded ? null : post.id)}>
                          {expanded ? "إخفاء التفاصيل" : "تفاصيل المنصات"}
                        </button>
                        {canRetryAny && (
                          <button className="icon-button" disabled={busyId === post.id} aria-label="إعادة محاولة كل المنصات الفاشلة" onClick={() => void retryAll(post.id)}>
                            {busyId === post.id && !busyPlatform ? <LoaderCircle className="spin" size={17} /> : <RefreshCw size={17} />}
                          </button>
                        )}
                        <button className="icon-button danger-ghost" disabled={busyId === post.id} aria-label="حذف" onClick={() => void remove(post.id)}><Trash2 size={17} /></button>
                      </div>
                    }
                  />
                  {expanded && (
                    <PostDetails
                      post={post}
                      busyPlatform={busyId === post.id ? busyPlatform : null}
                      onRetryPlatform={(platform) => void retryPlatform(post.id, platform)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        ) : <EmptyState icon={<History size={24} />} title="لا يوجد سجل نشر بعد" copy="أول محتوى تنشئه سيظهر هنا بنتيجة كل منصة." />}
      </section>
    </div>
  );
}
