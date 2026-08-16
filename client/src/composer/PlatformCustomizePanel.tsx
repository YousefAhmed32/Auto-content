import { Copy, LoaderCircle, RotateCcw } from "lucide-react";
import { defaultOverride, tiktokPrivacyLabels } from "./defaults";
import { PlatformMediaPicker, resolvedMediaFor } from "./PlatformMediaPicker";
import type { Platform, PlatformCapabilities, PlatformOverride, PostRecord, TikTokCreatorInfo, ValidationIssue } from "../types";

function CharCounter({ length, max }: { length: number; max?: number | null }) {
  if (!max) return <small className="field-counter">{length.toLocaleString("ar-EG")} حرف</small>;
  const over = length > max;
  return <small className={`field-counter ${over ? "over" : ""}`}>{length.toLocaleString("ar-EG")} / {max.toLocaleString("ar-EG")}</small>;
}

export function PlatformCustomizePanel({
  platform,
  capability,
  post,
  override,
  onChange,
  tiktokCreatorInfo,
  tiktokInfoLoading,
  onLoadTikTokInfo,
  issues
}: {
  platform: Platform;
  capability: PlatformCapabilities;
  post: PostRecord;
  override: PlatformOverride;
  onChange: (next: PlatformOverride) => void;
  tiktokCreatorInfo?: TikTokCreatorInfo | null;
  tiktokInfoLoading?: boolean;
  onLoadTikTokInfo?: () => void;
  issues: ValidationIssue[];
}) {
  const title = override.useCustomContent ? (override.title ?? post.base.title) : post.base.title;
  const caption = override.useCustomContent ? (override.caption ?? post.base.caption) : post.base.caption;
  const hashtags = override.useCustomContent ? (override.hashtags ?? post.base.hashtags) : post.base.hashtags;
  const selectedMedia = resolvedMediaFor(post.media, override.mediaOrder);
  const hasVideo = selectedMedia.some((item) => item.kind === "video");
  const maxMedia = Math.max(capability.image?.maxCount ?? 1, capability.video?.maxCount ?? 1);

  function enableCustom() {
    onChange({ ...override, useCustomContent: true, title, caption, hashtags });
  }
  function resetCustom() {
    onChange(defaultOverride(platform));
  }

  return (
    <div className="platform-panel">
      {issues.length > 0 && (
        <ul className="validation-list" aria-label={`تحذيرات ${capability.label}`}>
          {issues.map((issue, index) => (
            <li key={index} className={issue.severity}>{issue.message}</li>
          ))}
        </ul>
      )}

      <div className="platform-panel-section">
        <div className="platform-panel-section-head">
          <h3>الوسائط المستخدمة على {capability.label}</h3>
        </div>
        {post.media.length ? (
          <PlatformMediaPicker
            allMedia={post.media}
            selectedIds={override.mediaOrder ?? []}
            maxCount={maxMedia}
            onChange={(ids) => onChange({ ...override, mediaOrder: ids })}
          />
        ) : <p className="platform-panel-empty">أضف وسائط في الخطوة الأولى أولًا.</p>}
      </div>

      <div className="platform-panel-section">
        <div className="platform-panel-section-head">
          <h3>المحتوى النصي</h3>
          {override.useCustomContent ? (
            <button type="button" className="text-button" onClick={resetCustom}><RotateCcw size={14} /> إعادة تعيين للمحتوى الأساسي</button>
          ) : (
            <button type="button" className="text-button" onClick={enableCustom}><Copy size={14} /> نسخ وتخصيص لهذه المنصة</button>
          )}
        </div>

        {!override.useCustomContent ? (
          <p className="platform-panel-inherit">يُستخدم المحتوى الأساسي كما هو. اضغط "نسخ وتخصيص" لكتابة نص مختلف لـ{capability.label}.</p>
        ) : (
          <>
            {capability.title.supported && (
              <label className="field">
                <span>العنوان{capability.title.required ? " (مطلوب)" : ""}</span>
                <input value={title} maxLength={capability.title.maxLength} onChange={(event) => onChange({ ...override, title: event.target.value })} />
                <CharCounter length={title.length} max={capability.title.maxLength} />
              </label>
            )}
            <label className="field">
              <span>النص/الكابشن</span>
              <textarea rows={4} value={caption} onChange={(event) => onChange({ ...override, caption: event.target.value })} />
              <CharCounter length={caption.length} max={capability.caption.maxLength} />
            </label>
            <label className="field">
              <span>الهاشتاجات</span>
              <input
                value={hashtags.join(" ")}
                onChange={(event) => onChange({ ...override, hashtags: event.target.value.split(/\s+/).map((tag) => tag.trim().replace(/^#/, "")).filter(Boolean) })}
                placeholder="افصل بينها بمسافة"
              />
              <small className="field-counter">{hashtags.length} هاشتاج{capability.hashtags.recommendedMax ? ` (الموصى به حتى ${capability.hashtags.recommendedMax})` : ""}</small>
            </label>
          </>
        )}
      </div>

      {platform === "youtube" && capability.privacy.options && (
        <div className="platform-panel-section">
          <h3>خصوصية الفيديو</h3>
          <div className="segmented-control" role="group" aria-label="خصوصية YouTube">
            {capability.privacy.options.map((option) => (
              <button
                key={option.value}
                type="button"
                className={override.youtube?.privacy === option.value ? "active" : ""}
                onClick={() => onChange({ ...override, youtube: { privacy: option.value as "private" | "unlisted" | "public" } })}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {platform === "instagram" && capability.coverSelection.supported && hasVideo && (
        <div className="platform-panel-section">
          <h3>غلاف الفيديو/Reel</h3>
          <label className="field mini-field">
            <span>لحظة الغلاف (بالميلي ثانية من بداية الفيديو)</span>
            <input
              type="number"
              min={0}
              value={override.instagram?.coverThumbOffsetMs ?? 0}
              onChange={(event) => onChange({ ...override, instagram: { coverThumbOffsetMs: Math.max(0, Number(event.target.value)) } })}
            />
          </label>
        </div>
      )}

      {platform === "tiktok" && (
        <div className="platform-panel-section">
          <div className="platform-panel-section-head">
            <h3>إعدادات TikTok</h3>
            {!tiktokCreatorInfo && (
              <button type="button" className="text-button" onClick={onLoadTikTokInfo} disabled={tiktokInfoLoading}>
                {tiktokInfoLoading ? <LoaderCircle className="spin" size={14} /> : null} تحميل خيارات الحساب
              </button>
            )}
          </div>

          {tiktokCreatorInfo ? (
            <>
              <label className="field mini-field">
                <span>الخصوصية</span>
                <select
                  value={override.tiktok?.privacyLevel ?? tiktokCreatorInfo.privacyOptions[0] ?? "SELF_ONLY"}
                  onChange={(event) => onChange({ ...override, tiktok: { ...override.tiktok!, privacyLevel: event.target.value } })}
                >
                  {tiktokCreatorInfo.privacyOptions.map((option) => (
                    <option key={option} value={option}>{tiktokPrivacyLabels[option] ?? option}</option>
                  ))}
                </select>
              </label>
              <div className="toggle-grid">
                <label className="toggle-field">
                  <input type="checkbox" checked={override.tiktok?.allowComments ?? true} onChange={(event) => onChange({ ...override, tiktok: { ...override.tiktok!, allowComments: event.target.checked } })} />
                  <span>السماح بالتعليقات</span>
                </label>
                {hasVideo && (
                  <>
                    <label className="toggle-field">
                      <input type="checkbox" checked={override.tiktok?.allowDuet ?? true} onChange={(event) => onChange({ ...override, tiktok: { ...override.tiktok!, allowDuet: event.target.checked } })} />
                      <span>السماح بـ Duet</span>
                    </label>
                    <label className="toggle-field">
                      <input type="checkbox" checked={override.tiktok?.allowStitch ?? true} onChange={(event) => onChange({ ...override, tiktok: { ...override.tiktok!, allowStitch: event.target.checked } })} />
                      <span>السماح بـ Stitch</span>
                    </label>
                  </>
                )}
              </div>
              {hasVideo ? (
                <label className="field mini-field">
                  <span>لحظة غلاف الفيديو (ميلي ثانية)</span>
                  <input
                    type="number"
                    min={0}
                    value={override.tiktok?.coverTimestampMs ?? 1000}
                    onChange={(event) => onChange({ ...override, tiktok: { ...override.tiktok!, coverTimestampMs: Math.max(0, Number(event.target.value)) } })}
                  />
                </label>
              ) : selectedMedia.length > 1 && (
                <label className="field mini-field">
                  <span>صورة الغلاف</span>
                  <select
                    value={override.tiktok?.coverImageIndex ?? 0}
                    onChange={(event) => onChange({ ...override, tiktok: { ...override.tiktok!, coverImageIndex: Number(event.target.value) } })}
                  >
                    {selectedMedia.map((asset, index) => <option key={asset.id} value={index}>صورة {index + 1}</option>)}
                  </select>
                </label>
              )}
              <div className="toggle-grid">
                <label className="toggle-field">
                  <input type="checkbox" checked={override.tiktok?.brandOrganic ?? false} onChange={(event) => onChange({ ...override, tiktok: { ...override.tiktok!, brandOrganic: event.target.checked } })} />
                  <span>ترويج ذاتي لعملي التجاري (Brand Organic)</span>
                </label>
                <label className="toggle-field">
                  <input type="checkbox" checked={override.tiktok?.brandedContent ?? false} onChange={(event) => onChange({ ...override, tiktok: { ...override.tiktok!, brandedContent: event.target.checked } })} />
                  <span>شراكة مدفوعة مع جهة أخرى (Branded Content)</span>
                </label>
              </div>
              {override.tiktok?.brandedContent && <p className="field-hint">شراكة مدفوعة لا يمكن أن تكون خاصة بالكامل - سيُعدَّل مستوى الخصوصية تلقائيًا عند الحاجة.</p>}
            </>
          ) : (
            <p className="platform-panel-inherit">TikTok يشترط قراءة خيارات الحساب (الخصوصية والتعليقات) مباشرة قبل النشر. اضغط "تحميل خيارات الحساب".</p>
          )}
        </div>
      )}

      {platform === "facebook" && (
        <p className="platform-panel-inherit">Facebook لا يحتاج إعدادات إضافية غير المحتوى النصي والوسائط أعلاه.</p>
      )}
    </div>
  );
}

export function summarizeCapability(capability: PlatformCapabilities) {
  const parts: string[] = [];
  if (capability.image) parts.push(capability.carousel.supported ? `حتى ${capability.image.maxCount} صورة` : "صورة واحدة");
  if (capability.video) parts.push("فيديو واحد");
  return parts.join(" · ");
}
