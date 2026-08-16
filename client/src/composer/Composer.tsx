import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Save,
  Send
} from "lucide-react";
import { api } from "../api";
import { PageHeader, PlatformIcon, platformMeta } from "../components/shared";
import type { Connection, Platform, PlatformCapabilities, PostRecord, TikTokCreatorInfo } from "../types";
import { defaultOverride } from "./defaults";
import { MediaLibrary } from "./MediaLibrary";
import { PlatformCustomizePanel, summarizeCapability } from "./PlatformCustomizePanel";
import { PlatformPreviewCard } from "./PreviewCard";

const STEPS = [
  { id: 1, label: "المحتوى والوسائط" },
  { id: 2, label: "المنصات" },
  { id: 3, label: "تخصيص كل منصة" },
  { id: 4, label: "المعاينة والتحقق" },
  { id: 5, label: "النشر" }
] as const;

function StepIndicator({ step, furthestStep, onGo }: { step: number; furthestStep: number; onGo: (step: number) => void }) {
  return (
    <ol className="wizard-steps" aria-label="خطوات إنشاء المحتوى">
      {STEPS.map((item) => {
        const state = item.id === step ? "current" : item.id < step ? "done" : "upcoming";
        return (
          <li key={item.id} className={`wizard-step ${state}`}>
            <button type="button" disabled={item.id > furthestStep} onClick={() => onGo(item.id)}>
              <span className="wizard-step-dot">{state === "done" ? <Check size={13} /> : item.id}</span>
              <span className="wizard-step-label">{item.label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export function Composer({ draftId, connections, notify, onDone, registerDirty }: {
  draftId: string | null;
  connections: Connection[];
  notify: (message: string, type?: "success" | "error") => void;
  onDone: () => void;
  registerDirty: (dirty: boolean) => void;
}) {
  const [post, setPost] = useState<PostRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [furthestStep, setFurthestStep] = useState(1);
  const [activeTab, setActiveTab] = useState<Platform | null>(null);
  const [capabilities, setCapabilities] = useState<PlatformCapabilities[]>([]);
  const [tiktokCreatorInfo, setTiktokCreatorInfo] = useState<TikTokCreatorInfo | null>(null);
  const [tiktokInfoLoading, setTiktokInfoLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [submitting, setSubmitting] = useState<"draft" | "schedule" | "now" | null>(null);
  const [scheduledLocal, setScheduledLocal] = useState("");
  const savedSnapshot = useRef<string>("");
  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  useEffect(() => { registerDirty(dirty); }, [dirty, registerDirty]);

  useEffect(() => {
    void (async () => {
      const { capabilities: list } = await api.capabilities();
      setCapabilities(list);
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        if (draftId) {
          const { post: existing } = await api.post(draftId);
          setPost(existing);
          if (existing.scheduledAt) setScheduledLocal(existing.scheduledAt.slice(0, 16));
          savedSnapshot.current = snapshotOf(existing);
        } else {
          const { post: created } = await api.createDraft({});
          setPost(created);
          savedSnapshot.current = snapshotOf(created);
        }
      } catch (error) {
        notify(error instanceof Error ? error.message : "تعذر تحضير المحتوى", "error");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId]);

  useEffect(() => {
    if (post && post.platforms.length && !activeTab) setActiveTab(post.platforms[0]!);
    if (post && activeTab && !post.platforms.includes(activeTab)) setActiveTab(post.platforms[0] ?? null);
  }, [post, activeTab]);

  function snapshotOf(value: PostRecord) {
    return JSON.stringify({
      title: value.base.title,
      caption: value.base.caption,
      hashtags: value.base.hashtags,
      platforms: value.platforms,
      overrides: value.overrides,
      publishMode: value.publishMode,
      scheduledAt: value.scheduledAt,
      timezone: value.timezone
    });
  }

  // Autosave: يحفظ المحتوى/المنصات/التخصيص بعد توقف قصير عن الكتابة، دون إزعاج المستخدم بأزرار حفظ يدوية.
  useEffect(() => {
    if (!post) return;
    const snapshot = snapshotOf(post);
    if (snapshot === savedSnapshot.current) { setDirty(false); return; }
    setDirty(true);
    const timer = setTimeout(async () => {
      setSaving(true);
      try {
        const { post: updated } = await api.updatePost(post.id, JSON.parse(snapshot));
        savedSnapshot.current = snapshot;
        setDirty(false);
        setPost((current) => (current ? { ...current, validation: updated.validation, status: updated.status, updatedAt: updated.updatedAt } : current));
      } catch (error) {
        notify(error instanceof Error ? error.message : "تعذر حفظ التغييرات تلقائيًا", "error");
      } finally {
        setSaving(false);
      }
    }, 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post?.base.title, post?.base.caption, post?.base.hashtags, post?.platforms, post?.overrides, post?.publishMode, post?.scheduledAt, post?.timezone]);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  async function loadTikTokInfo() {
    setTiktokInfoLoading(true);
    try { setTiktokCreatorInfo(await api.tiktokCreatorInfo()); }
    catch (error) { notify(error instanceof Error ? error.message : "تعذر تحميل إعدادات TikTok - تأكد من ربط الحساب", "error"); }
    finally { setTiktokInfoLoading(false); }
  }

  function goTo(next: number) {
    const clamped = Math.min(Math.max(next, 1), STEPS.length);
    setStep(clamped);
    setFurthestStep((current) => Math.max(current, clamped));
  }

  function togglePlatform(platform: Platform) {
    if (!post) return;
    const active = post.platforms.includes(platform);
    const nextPlatforms = active ? post.platforms.filter((item) => item !== platform) : [...post.platforms, platform];
    setPost({ ...post, platforms: nextPlatforms });
    if (platform === "tiktok" && !active) void loadTikTokInfo();
  }

  async function persistNow(overrides: Partial<Pick<PostRecord, "publishMode" | "scheduledAt" | "timezone">> = {}) {
    if (!post) return null;
    const payload = {
      title: post.base.title,
      caption: post.base.caption,
      hashtags: post.base.hashtags,
      platforms: post.platforms,
      overrides: post.overrides,
      publishMode: overrides.publishMode ?? post.publishMode,
      scheduledAt: overrides.scheduledAt ?? post.scheduledAt,
      timezone: overrides.timezone ?? timezone
    };
    const { post: updated } = await api.updatePost(post.id, payload);
    savedSnapshot.current = snapshotOf(updated);
    setPost(updated);
    setDirty(false);
    return updated;
  }

  async function saveDraft() {
    setSubmitting("draft");
    try {
      await persistNow({ publishMode: "now" });
      notify("تم حفظ المسودة");
      onDone();
    } catch (error) { notify(error instanceof Error ? error.message : "تعذر حفظ المسودة", "error"); }
    finally { setSubmitting(null); }
  }

  async function schedule() {
    if (!scheduledLocal) return notify("اختر موعد الجدولة أولًا", "error");
    const iso = new Date(scheduledLocal).toISOString();
    if (new Date(iso).getTime() <= Date.now()) return notify("موعد الجدولة يجب أن يكون في المستقبل", "error");
    setSubmitting("schedule");
    try {
      const updated = await persistNow({ publishMode: "scheduled", scheduledAt: iso });
      if (updated?.validation && Object.values(updated.validation).some((list) => list?.some((issue) => issue.severity === "error"))) {
        notify("تم الحفظ، لكن هناك تحذيرات يجب حلها قبل موعد النشر - راجع خطوة المعاينة", "error");
      } else {
        notify("تمت جدولة المحتوى بنجاح");
      }
      onDone();
    } catch (error) { notify(error instanceof Error ? error.message : "تعذر حفظ الجدولة", "error"); }
    finally { setSubmitting(null); }
  }

  async function publishNow() {
    setSubmitting("now");
    try {
      const updated = await persistNow({ publishMode: "now" });
      if (!updated) return;
      await api.publish(updated.id);
      notify("بدأ نشر المحتوى على المنصات المختارة");
      onDone();
    } catch (error) { notify(error instanceof Error ? error.message : "تعذر بدء النشر", "error"); }
    finally { setSubmitting(null); }
  }

  if (loading || !post) {
    return (
      <div className="view-stack compose-view">
        <PageHeader eyebrow="مركز النشر" title="محتوى جديد" copy="جاري التحضير…" />
        <div className="post-skeletons"><span /><span /><span /></div>
      </div>
    );
  }

  const capabilityByPlatform = new Map(capabilities.map((item) => [item.platform, item]));
  const canGoStep2 = post.media.length > 0;
  const canGoStep3 = post.platforms.length > 0;
  const validation = post.validation ?? {};
  const blockingErrors = Object.values(validation).some((list) => list?.some((issue) => issue.severity === "error"));
  const readyCount = post.platforms.filter((platform) => !validation[platform]?.some((issue) => issue.severity === "error")).length;

  return (
    <div className="view-stack compose-view">
      <PageHeader
        eyebrow="مركز النشر"
        title="محتوى جديد"
        copy="جهّز المحتوى مرة واحدة، خصّصه لكل منصة، ثم انشر أو جدوله."
        action={<span className="autosave-indicator">{saving ? <><LoaderCircle className="spin" size={14} /> جارٍ الحفظ…</> : dirty ? "تغييرات غير محفوظة" : <><CheckCircle2 size={14} /> محفوظ</>}</span>}
      />

      <StepIndicator step={step} furthestStep={furthestStep} onGo={goTo} />

      {step === 1 && (
        <section className="panel compose-main">
          <div className="form-section-title"><span>01</span><div><h2>المحتوى الأساسي والوسائط</h2><p>هذا هو المحتوى المشترك؛ يمكنك تخصيصه لاحقًا لكل منصة.</p></div></div>
          <div className="field-grid">
            <label className="field full-field">
              <span>عنوان المحتوى</span>
              <input maxLength={200} value={post.base.title} onChange={(event) => setPost({ ...post, base: { ...post.base, title: event.target.value } })} placeholder="عنوان داخلي يساعدك في إدارة السجل (يُستخدم كعنوان فعلي على YouTube)" />
              <small className="field-counter">{post.base.title.length}/200</small>
            </label>
            <label className="field full-field">
              <span>الكابشن</span>
              <textarea rows={6} maxLength={5000} value={post.base.caption} onChange={(event) => setPost({ ...post, base: { ...post.base, caption: event.target.value } })} placeholder="اكتب الرسالة الأساسية هنا..." />
              <small className="field-counter">{post.base.caption.length}/5000</small>
            </label>
            <label className="field full-field">
              <span>الهاشتاجات</span>
              <input
                value={post.base.hashtags.join(" ")}
                onChange={(event) => setPost({ ...post, base: { ...post.base, hashtags: event.target.value.split(/\s+/).map((tag) => tag.trim().replace(/^#/, "")).filter(Boolean) } })}
                placeholder="#وصفة  #مطبخ"
              />
              <small className="field-counter">افصل بينها بمسافة</small>
            </label>
          </div>
          <MediaLibrary post={post} onPostUpdate={setPost} notify={notify} />
        </section>
      )}

      {step === 2 && (
        <section className="panel compose-main">
          <div className="form-section-title"><span>02</span><div><h2>اختر منصات النشر</h2><p>يمكنك اختيار أكثر من منصة - كل منصة تُنشر وتُتابع بشكل مستقل.</p></div></div>
          <div className="platform-selector grid">
            {connections.map((connection) => {
              const active = post.platforms.includes(connection.platform);
              const capability = capabilityByPlatform.get(connection.platform);
              return (
                <button
                  key={connection.platform}
                  type="button"
                  className={`platform-choice ${active ? "selected" : ""}`}
                  aria-pressed={active}
                  onClick={() => togglePlatform(connection.platform)}
                >
                  <PlatformIcon platform={connection.platform} />
                  <span>
                    <strong>{platformMeta[connection.platform].name}</strong>
                    <small>{connection.connected ? connection.accountName : "سيحاول النشر بعد الربط"}</small>
                    {capability && <small className="platform-choice-caps">{summarizeCapability(capability)}</small>}
                  </span>
                  <span className="choice-check">{active && <Check size={14} />}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="panel compose-main">
          <div className="form-section-title"><span>03</span><div><h2>تخصيص كل منصة</h2><p>الإعدادات المعروضة هنا مبنية على قدرات كل منصة فعليًا - لا تظهر خيارات غير مدعومة.</p></div></div>
          {post.platforms.length ? (
            <>
              <div className="platform-tabs" role="tablist">
                {post.platforms.map((platform) => (
                  <button key={platform} type="button" role="tab" aria-selected={activeTab === platform} className={activeTab === platform ? "active" : ""} onClick={() => setActiveTab(platform)}>
                    <PlatformIcon platform={platform} size="small" /> {platformMeta[platform].name}
                    {validation[platform]?.some((issue) => issue.severity === "error") && <AlertTriangle size={13} className="tab-warning" />}
                  </button>
                ))}
              </div>
              {activeTab && capabilityByPlatform.get(activeTab) && (
                <PlatformCustomizePanel
                  platform={activeTab}
                  capability={capabilityByPlatform.get(activeTab)!}
                  post={post}
                  override={post.overrides[activeTab] ?? defaultOverride(activeTab)}
                  onChange={(next) => setPost({ ...post, overrides: { ...post.overrides, [activeTab]: next } })}
                  tiktokCreatorInfo={tiktokCreatorInfo}
                  tiktokInfoLoading={tiktokInfoLoading}
                  onLoadTikTokInfo={loadTikTokInfo}
                  issues={validation[activeTab] ?? []}
                />
              )}
            </>
          ) : <p className="platform-panel-empty">اختر منصة واحدة على الأقل من الخطوة السابقة.</p>}
        </section>
      )}

      {step === 4 && (
        <section className="panel compose-main">
          <div className="form-section-title"><span>04</span><div><h2>المعاينة والتحقق</h2><p>{readyCount} من {post.platforms.length} منصة جاهزة للنشر.</p></div></div>
          <div className="preview-grid">
            {post.platforms.map((platform) => (
              <PlatformPreviewCard key={platform} platform={platform} post={post} connection={connections.find((item) => item.platform === platform)} issues={validation[platform] ?? []} />
            ))}
          </div>
        </section>
      )}

      {step === 5 && (
        <section className="panel compose-main">
          <div className="form-section-title"><span>05</span><div><h2>النشر</h2><p>احفظ كمسودة، جدول الموعد، أو انشر الآن.</p></div></div>
          {blockingErrors && (
            <p className="validation-banner error"><AlertTriangle size={16} /> هناك تحذيرات يجب حلها قبل الجدولة أو النشر - راجع خطوة المعاينة.</p>
          )}
          <div className="publish-actions-grid">
            <button type="button" className="secondary-button" disabled={submitting !== null} onClick={() => void saveDraft()}>
              {submitting === "draft" ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />} حفظ كمسودة
            </button>
            <div className="schedule-box">
              <label className="field mini-field">
                <span><Calendar size={14} /> جدولة لموعد لاحق</span>
                <input type="datetime-local" value={scheduledLocal} min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)} onChange={(event) => setScheduledLocal(event.target.value)} />
              </label>
              <button type="button" className="secondary-button" disabled={submitting !== null || !scheduledLocal} onClick={() => void schedule()}>
                {submitting === "schedule" ? <LoaderCircle className="spin" size={17} /> : <Calendar size={17} />} جدولة
              </button>
            </div>
            <button type="button" className="publish-button" disabled={submitting !== null || blockingErrors} onClick={() => void publishNow()}>
              {submitting === "now" ? <LoaderCircle className="spin" size={19} /> : <Send size={19} />} انشر الآن
            </button>
          </div>
        </section>
      )}

      <nav className="wizard-nav">
        <button type="button" className="secondary-button" disabled={step === 1} onClick={() => goTo(step - 1)}><ChevronRight size={16} /> السابق</button>
        {step < STEPS.length && (
          <button
            type="button"
            className="primary-button"
            disabled={(step === 1 && !canGoStep2) || (step === 2 && !canGoStep3)}
            onClick={() => goTo(step + 1)}
          >
            التالي <ChevronLeft size={16} />
          </button>
        )}
      </nav>
    </div>
  );
}
