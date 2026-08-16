import { useState } from "react";
import { AlertTriangle, Calendar, CheckCircle2, ChevronDown, ImageOff, Layers, LoaderCircle, Save, Send, X } from "lucide-react";
import { PlatformIcon, platformMeta } from "../components/shared";
import type { Connection, Platform, PlatformCapabilities, PostRecord, TikTokCreatorInfo, ValidationIssue } from "../types";
import { defaultOverride } from "./defaults";
import { MediaLibrary } from "./MediaLibrary";
import { PlatformCustomizePanel } from "./PlatformCustomizePanel";
import { PlatformSelector } from "./PlatformSelector";
import { getUnconnectedSelectedPlatforms, isMediaConflictIssue, truncateMediaForCapability } from "./platformGuards";

function MediaConflictBanner({ platform, issues, maxCount, onExclude, onUseFirstN }: {
  platform: Platform;
  issues: ValidationIssue[];
  maxCount?: number;
  onExclude: () => void;
  onUseFirstN?: () => void;
}) {
  return (
    <div className="conflict-banner">
      <span className="conflict-banner-icon"><ImageOff size={18} /></span>
      <div className="conflict-banner-body">
        <strong>{platformMeta[platform].name} لا يناسب الوسائط الحالية</strong>
        <ul>
          {issues.map((issue, index) => <li key={index}>{issue.message}</li>)}
        </ul>
        <div className="conflict-banner-actions">
          {onUseFirstN && maxCount && (
            <button type="button" className="secondary-button" onClick={onUseFirstN}>
              استخدام أول {maxCount} {maxCount === 1 ? "ملف" : "ملفات"} فقط لهذه المنصة
            </button>
          )}
          <button type="button" className="secondary-button danger-ghost" onClick={onExclude}>
            استبعاد {platformMeta[platform].name} من هذا المنشور
          </button>
        </div>
      </div>
    </div>
  );
}

export function SimplePublisher({
  post,
  setPost,
  capabilities,
  connections,
  tiktokCreatorInfo,
  tiktokInfoLoading,
  onLoadTikTokInfo,
  onTogglePlatform,
  notify,
  scheduledLocal,
  setScheduledLocal,
  submitting,
  onSaveDraft,
  onSchedule,
  onPublishNow
}: {
  post: PostRecord;
  setPost: (post: PostRecord) => void;
  capabilities: PlatformCapabilities[];
  connections: Connection[];
  tiktokCreatorInfo: TikTokCreatorInfo | null;
  tiktokInfoLoading: boolean;
  onLoadTikTokInfo: () => void;
  onTogglePlatform: (platform: Platform) => void;
  notify: (message: string, type?: "success" | "error") => void;
  scheduledLocal: string;
  setScheduledLocal: (value: string) => void;
  submitting: "draft" | "schedule" | "now" | null;
  onSaveDraft: () => void;
  onSchedule: () => void;
  onPublishNow: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const capabilityByPlatform = new Map(capabilities.map((item) => [item.platform, item]));
  const validation = post.validation ?? {};
  const needsYoutubeTitle = post.platforms.includes("youtube");
  const unconnected = getUnconnectedSelectedPlatforms(post.platforms, connections);
  const blockingErrors = Object.values(validation).some((list) => list?.some((issue) => issue.severity === "error"));
  const canPublishNow = post.platforms.length > 0 && post.media.length > 0 && !blockingErrors && unconnected.length === 0;
  const platformNames = post.platforms.map((platform) => platformMeta[platform].name).join("، ");

  function excludePlatform(platform: Platform) {
    setPost({ ...post, platforms: post.platforms.filter((item) => item !== platform) });
  }

  function useFirstNForPlatform(platform: Platform, kind: "image" | "video", count: number) {
    const override = post.overrides[platform] ?? defaultOverride(platform);
    setPost({
      ...post,
      overrides: { ...post.overrides, [platform]: { ...override, mediaOrder: truncateMediaForCapability(post.media, kind, count) } }
    });
  }

  return (
    <div className="simple-publisher">
      <section className="panel compose-main">
        <div className="form-section-title"><span>1</span><div><h2>المنصات</h2><p>اختر منصة واحدة أو أكثر - كل منصة تُنشر وتُتابع بشكل مستقل.</p></div></div>
        <PlatformSelector connections={connections} capabilities={capabilities} selected={post.platforms} onToggle={onTogglePlatform} />
      </section>

      <section className="panel compose-main">
        <div className="form-section-title"><span>2</span><div><h2>المحتوى</h2><p>نص مختصر يكفي للنشر السريع - يمكن تخصيصه لاحقًا لكل منصة أدناه.</p></div></div>
        <div className="field-grid">
          {needsYoutubeTitle && (
            <label className="field full-field">
              <span>عنوان الفيديو (مطلوب لـ YouTube)</span>
              <input maxLength={200} value={post.base.title} onChange={(event) => setPost({ ...post, base: { ...post.base, title: event.target.value } })} placeholder="عنوان واضح للفيديو" />
              <small className="field-counter">{post.base.title.length}/200</small>
            </label>
          )}
          <label className="field full-field">
            <span>النص / الكابشن</span>
            <textarea rows={4} maxLength={5000} value={post.base.caption} onChange={(event) => setPost({ ...post, base: { ...post.base, caption: event.target.value } })} placeholder="اكتب رسالتك هنا..." />
            <small className="field-counter">{post.base.caption.length}/5000</small>
          </label>
          <label className="field full-field">
            <span>الهاشتاجات (اختياري)</span>
            <input
              value={post.base.hashtags.join(" ")}
              onChange={(event) => setPost({ ...post, base: { ...post.base, hashtags: event.target.value.split(/\s+/).map((tag) => tag.trim().replace(/^#/, "")).filter(Boolean) } })}
              placeholder="#وصفة  #مطبخ"
            />
          </label>
        </div>
      </section>

      <section className="panel compose-main">
        <div className="form-section-title"><span>3</span><div><h2>الصور والفيديو</h2><p>ارفع صورة واحدة أو أكثر، ورتّبها بالسحب - نفس ترتيب الظهور في المنشور.</p></div></div>
        <MediaLibrary post={post} onPostUpdate={setPost} notify={notify} compact />
        <p className="field-hint">اختيار الغلاف وإعدادات كل منصة التفصيلية متاحة داخل "خيارات إضافية" أسفل كل منصة.</p>
      </section>

      {post.platforms.map((platform) => {
        const issues = (validation[platform] ?? []).filter((issue) => issue.severity === "error" && isMediaConflictIssue(issue.code));
        if (!issues.length) return null;
        const capability = capabilityByPlatform.get(platform);
        // لا نعرض "استخدام أول N فقط" إن كان التعارض بسبب خلط صور/فيديو غير مدعوم - تقليص العدد لا يحل هذا التعارض.
        const isMixedMediaConflict = issues.some((issue) => issue.code === "mixed-media-unsupported");
        const overCountImages = issues.some((issue) => issue.code === "image-count-max");
        const overCountVideos = issues.some((issue) => issue.code === "video-count");
        const truncateKind: "image" | "video" | null = !isMixedMediaConflict && overCountImages ? "image" : !isMixedMediaConflict && overCountVideos ? "video" : null;
        const maxCount = truncateKind === "image" ? capability?.image?.maxCount : truncateKind === "video" ? capability?.video?.maxCount : undefined;
        return (
          <MediaConflictBanner
            key={platform}
            platform={platform}
            issues={issues}
            maxCount={maxCount}
            onExclude={() => excludePlatform(platform)}
            onUseFirstN={truncateKind && maxCount ? () => useFirstNForPlatform(platform, truncateKind, maxCount) : undefined}
          />
        );
      })}

      {post.platforms.length > 0 && (
        <section className="panel compose-main">
          <div className="form-section-title compact"><span><Layers size={15} /></span><div><h2>خيارات إضافية لكل منصة</h2><p>مغلقة افتراضيًا لإبقاء التجربة بسيطة - تحتوي كل الإعدادات المدعومة فعليًا لكل منصة.</p></div></div>
          <div className="platform-accordions">
            {post.platforms.map((platform) => {
              const capability = capabilityByPlatform.get(platform);
              if (!capability) return null;
              const hasErrors = validation[platform]?.some((issue) => issue.severity === "error");
              return (
                <details className="platform-accordion" key={platform}>
                  <summary>
                    <PlatformIcon platform={platform} size="small" />
                    <span>خيارات إضافية - {platformMeta[platform].name}</span>
                    {hasErrors && <AlertTriangle size={14} className="tab-warning" />}
                    <ChevronDown size={16} className="platform-accordion-chevron" aria-hidden="true" />
                  </summary>
                  <PlatformCustomizePanel
                    platform={platform}
                    capability={capability}
                    post={post}
                    override={post.overrides[platform] ?? defaultOverride(platform)}
                    onChange={(next) => setPost({ ...post, overrides: { ...post.overrides, [platform]: next } })}
                    tiktokCreatorInfo={tiktokCreatorInfo}
                    tiktokInfoLoading={tiktokInfoLoading}
                    onLoadTikTokInfo={onLoadTikTokInfo}
                    issues={validation[platform] ?? []}
                  />
                </details>
              );
            })}
          </div>
        </section>
      )}

      <section className="panel compose-main">
        <div className="form-section-title"><span>4</span><div><h2>النشر</h2><p>احفظ كمسودة، جدول الموعد، أو انشر الآن.</p></div></div>

        {unconnected.length > 0 && (
          <p className="validation-banner error">
            <AlertTriangle size={16} /> يلزم ربط الحساب أولًا للنشر الفوري على: {unconnected.map((platform) => platformMeta[platform].name).join("، ")}. يمكنك مع ذلك الجدولة أو حفظ المسودة الآن.
          </p>
        )}
        {blockingErrors && unconnected.length === 0 && (
          <p className="validation-banner error"><AlertTriangle size={16} /> هناك تحذيرات يجب حلها قبل النشر - راجع الأقسام أعلاه.</p>
        )}

        {!confirming ? (
          <div className="publish-actions-grid">
            <button type="button" className="secondary-button" disabled={submitting !== null} onClick={onSaveDraft}>
              {submitting === "draft" ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />} حفظ كمسودة
            </button>
            <div className="schedule-box">
              <label className="field mini-field">
                <span><Calendar size={14} /> جدولة لموعد لاحق</span>
                <input type="datetime-local" value={scheduledLocal} min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)} onChange={(event) => setScheduledLocal(event.target.value)} />
              </label>
              <button type="button" className="secondary-button" disabled={submitting !== null || !scheduledLocal} onClick={onSchedule}>
                {submitting === "schedule" ? <LoaderCircle className="spin" size={17} /> : <Calendar size={17} />} جدولة
              </button>
            </div>
            <button type="button" className="publish-button" disabled={submitting !== null || !canPublishNow} onClick={() => setConfirming(true)}>
              <Send size={19} /> انشر الآن
            </button>
          </div>
        ) : (
          <div className="publish-confirm">
            <h3>مراجعة قبل النشر</h3>
            <ul className="publish-confirm-summary">
              <li><strong>المنصات:</strong> {platformNames}</li>
              <li><strong>الوسائط:</strong> {post.media.length} {post.media.length === 1 ? "ملف" : "ملفات"}</li>
              <li><strong>النص:</strong> {post.base.caption ? `${post.base.caption.slice(0, 80)}${post.base.caption.length > 80 ? "…" : ""}` : "بدون نص"}</li>
            </ul>
            <div className="publish-confirm-actions">
              <button type="button" className="secondary-button" onClick={() => setConfirming(false)}><X size={16} /> تراجع</button>
              <button type="button" className="publish-button" disabled={submitting !== null} onClick={onPublishNow}>
                {submitting === "now" ? <LoaderCircle className="spin" size={19} /> : <CheckCircle2 size={19} />} تأكيد ونشر الآن
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
