import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowLeft,
  BarChart3,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronLeft,
  CircleAlert,
  Clock3,
  CloudUpload,
  FileImage,
  Gauge,
  History,
  Link2,
  LoaderCircle,
  Menu,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Rocket,
  Send,
  Settings2,
  Trash2,
  UploadCloud,
  X
} from "lucide-react";
import { FaFacebookF, FaInstagram, FaTiktok, FaYoutube } from "react-icons/fa6";
import { api, type Connection, type DashboardData, type Platform, type PostRecord, type View } from "./api";

const platformMeta: Record<Platform, { name: string; subline: string; icon: typeof FaFacebookF; tone: string }> = {
  facebook: { name: "Facebook", subline: "الصفحات والمنشورات", icon: FaFacebookF, tone: "facebook" },
  instagram: { name: "Instagram", subline: "الصور وReels", icon: FaInstagram, tone: "instagram" },
  tiktok: { name: "TikTok", subline: "الفيديو والصور", icon: FaTiktok, tone: "tiktok" },
  youtube: { name: "YouTube", subline: "الفيديو وShorts", icon: FaYoutube, tone: "youtube" }
};

const navItems: Array<{ id: View; label: string; icon: typeof Gauge }> = [
  { id: "overview", label: "نظرة عامة", icon: Gauge },
  { id: "compose", label: "محتوى جديد", icon: Plus },
  { id: "posts", label: "سجل النشر", icon: History },
  { id: "connections", label: "الحسابات", icon: Link2 }
];

const statusMeta: Record<PostRecord["status"], { label: string; className: string }> = {
  draft: { label: "مسودة", className: "neutral" },
  scheduled: { label: "مجدول", className: "scheduled" },
  publishing: { label: "جاري النشر", className: "progress" },
  published: { label: "تم النشر", className: "success" },
  partial: { label: "تم جزئيًا", className: "warning" },
  failed: { label: "فشل", className: "danger" }
};

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand" aria-label="YANSY Publish">
      <span className="brand-mark" aria-hidden="true"><span /></span>
      {!compact && <span className="brand-copy"><strong dir="ltr">YANSY</strong><small dir="ltr">PUBLISH</small></span>}
    </div>
  );
}

function PlatformIcon({ platform, size = "normal" }: { platform: Platform; size?: "small" | "normal" | "large" }) {
  const item = platformMeta[platform];
  const Icon = item.icon;
  return <span className={`platform-icon ${item.tone} ${size}`} aria-label={item.name}><Icon aria-hidden="true" /></span>;
}

function StatusBadge({ status }: { status: PostRecord["status"] }) {
  const item = statusMeta[status];
  return <span className={`status-badge ${item.className}`}><span />{item.label}</span>;
}

function formatDate(value?: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ar-EG", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function EmptyState({ icon, title, copy, action }: { icon: ReactNode; title: string; copy: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <span className="empty-icon">{icon}</span>
      <h3>{title}</h3>
      <p>{copy}</p>
      {action}
    </div>
  );
}

function PageHeader({ eyebrow, title, copy, action }: { eyebrow: string; title: string; copy: string; action?: ReactNode }) {
  return (
    <header className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{copy}</p>
      </div>
      {action}
    </header>
  );
}

function Overview({ data, connections, loading, onNavigate }: {
  data: DashboardData | null;
  connections: Connection[];
  loading: boolean;
  onNavigate: (view: View) => void;
}) {
  const metrics = [
    { label: "إجمالي المحتوى", value: data?.metrics.total ?? 0, detail: `${data?.metrics.thisMonth ?? 0} هذا الشهر`, icon: BarChart3 },
    { label: "تم نشره", value: data?.metrics.published ?? 0, detail: "عبر كل المنصات", icon: CheckCircle2 },
    { label: "في الانتظار", value: data?.metrics.scheduled ?? 0, detail: "محتوى مجدول", icon: CalendarClock },
    { label: "يحتاج مراجعة", value: data?.metrics.failures ?? 0, detail: "محاولات غير مكتملة", icon: CircleAlert }
  ];
  const connectedCount = connections.filter((item) => item.connected).length;

  return (
    <div className="view-stack">
      <PageHeader
        eyebrow="مساحة العمل"
        title="المحتوى كله، من مكان واحد."
        copy="ارفع مرة واحدة، اضبط النسخة المناسبة، وانشر على حساباتك بدون تكرار نفس الخطوات."
        action={<button className="primary-button" onClick={() => onNavigate("compose")}><Plus size={18} /> محتوى جديد</button>}
      />

      <section className="overview-hero">
        <div className="hero-copy">
          <span className="hero-label"><span className="pulse-dot" /> جاهز لاستقبال محتوى جديد</span>
          <h2>من الملف إلى كل منصة،<br /><em>بمسار واحد واضح.</em></h2>
          <p>اختار حسابات النشر، اكتب الكابشن، وانشر الآن أو في الموعد المناسب.</p>
          <button className="hero-action" onClick={() => onNavigate("compose")}>ابدأ منشورًا جديدًا <ArrowLeft size={18} /></button>
        </div>
        <div className="distribution-visual" aria-hidden="true">
          <div className="signal-lines line-one" />
          <div className="signal-lines line-two" />
          <div className="center-node"><UploadCloud size={27} /><span>ملف واحد</span></div>
          <div className="satellite sat-facebook"><PlatformIcon platform="facebook" /></div>
          <div className="satellite sat-instagram"><PlatformIcon platform="instagram" /></div>
          <div className="satellite sat-tiktok"><PlatformIcon platform="tiktok" /></div>
          <div className="satellite sat-youtube"><PlatformIcon platform="youtube" /></div>
        </div>
      </section>

      <section className="metric-grid" aria-label="ملخص الأداء">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <article className="metric-card" key={metric.label}>
              <div className="metric-top"><span>{metric.label}</span><Icon size={18} /></div>
              <strong>{loading ? <span className="skeleton-number" /> : metric.value.toLocaleString("ar-EG")}</strong>
              <small>{metric.detail}</small>
            </article>
          );
        })}
      </section>

      <section className="content-grid">
        <article className="panel recent-panel">
          <div className="panel-heading">
            <div><span className="section-kicker">آخر النشاط</span><h2>المحتوى الأخير</h2></div>
            <button className="text-button" onClick={() => onNavigate("posts")}>عرض الكل <ChevronLeft size={17} /></button>
          </div>
          {loading ? (
            <div className="post-skeletons"><span /><span /><span /></div>
          ) : data?.recentPosts.length ? (
            <div className="post-list compact-list">
              {data.recentPosts.map((post) => <PostRow post={post} key={post.id} />)}
            </div>
          ) : (
            <EmptyState
              icon={<FileImage size={24} />}
              title="أول منشور يبدأ من هنا"
              copy="بعد رفع أول محتوى سيظهر سجله وحالته في هذه المساحة."
              action={<button className="secondary-button" onClick={() => onNavigate("compose")}>إنشاء محتوى</button>}
            />
          )}
        </article>

        <aside className="panel accounts-panel">
          <div className="panel-heading">
            <div><span className="section-kicker">التكاملات</span><h2>الحسابات المتصلة</h2></div>
            <span className="connected-count">{connectedCount}/4</span>
          </div>
          <div className="account-mini-list">
            {connections.map((connection) => (
              <div className="account-mini" key={connection.platform}>
                <PlatformIcon platform={connection.platform} />
                <div><strong>{platformMeta[connection.platform].name}</strong><small>{connection.connected ? connection.accountName : "غير متصل"}</small></div>
                <span className={connection.connected ? "connection-dot active" : "connection-dot"} />
              </div>
            ))}
          </div>
          <button className="full-text-button" onClick={() => onNavigate("connections")}>إدارة ربط الحسابات <ArrowLeft size={17} /></button>
        </aside>
      </section>
    </div>
  );
}

function PostRow({ post, actions }: { post: PostRecord; actions?: ReactNode }) {
  return (
    <article className="post-row">
      <div className="post-thumb">
        {post.media.mimeType.startsWith("image/")
          ? <img src={post.media.url} alt="" loading="lazy" />
          : <span><Rocket size={20} /></span>}
      </div>
      <div className="post-primary">
        <div className="post-title-line"><h3>{post.title}</h3><StatusBadge status={post.status} /></div>
        <div className="post-meta"><Clock3 size={14} /> {formatDate(post.scheduledAt ?? post.createdAt)}</div>
      </div>
      <div className="post-platforms" aria-label="منصات النشر">
        {post.platforms.map((platform) => <PlatformIcon platform={platform} size="small" key={platform} />)}
      </div>
      {actions}
    </article>
  );
}

function Composer({ connections, onCreated, notify }: {
  connections: Connection[];
  onCreated: () => void;
  notify: (message: string, type?: "success" | "error") => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [selected, setSelected] = useState<Platform[]>([]);
  const [publishMode, setPublishMode] = useState<"now" | "scheduled">("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [youtubePrivacy, setYoutubePrivacy] = useState<"private" | "unlisted" | "public">("private");
  const [submitting, setSubmitting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const preview = useMemo(() => file ? URL.createObjectURL(file) : "", [file]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function togglePlatform(platform: Platform) {
    setSelected((current) => current.includes(platform)
      ? current.filter((item) => item !== platform)
      : [...current, platform]);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file) return notify("اختر صورة أو فيديو أولًا", "error");
    if (!selected.length) return notify("اختر منصة واحدة على الأقل", "error");
    const body = new FormData();
    body.append("media", file);
    body.append("title", title);
    body.append("caption", caption);
    body.append("hashtags", hashtags);
    body.append("platforms", JSON.stringify(selected));
    body.append("publishMode", publishMode);
    body.append("youtubePrivacy", youtubePrivacy);
    if (scheduledAt) body.append("scheduledAt", new Date(scheduledAt).toISOString());
    setSubmitting(true);
    try {
      await api.createPost(body);
      notify(publishMode === "now" ? "بدأ نشر المحتوى على الحسابات المختارة" : "تمت جدولة المحتوى بنجاح");
      onCreated();
    } catch (error) {
      notify(error instanceof Error ? error.message : "تعذر إنشاء المنشور", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="view-stack compose-view">
      <PageHeader eyebrow="مركز النشر" title="محتوى جديد" copy="جهّز النسخة مرة واحدة، ثم حدّد أين ومتى تظهر." />
      <form className="composer-layout" onSubmit={submit}>
        <section className="compose-main panel">
          <div className="form-section-title"><span>01</span><div><h2>الملف والمحتوى</h2><p>أضف الملف الأساسي والنص الذي سيصاحبه.</p></div></div>
          <input
            ref={fileInput}
            className="visually-hidden"
            id="media"
            type="file"
            accept="image/*,video/*"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          {!file ? (
            <button className="upload-zone" type="button" onClick={() => fileInput.current?.click()}>
              <span className="upload-icon"><CloudUpload size={26} /></span>
              <strong>اسحب الملف هنا أو اختره من جهازك</strong>
              <small>صورة أو فيديو حتى 512MB</small>
              <span className="choose-file">اختيار ملف</span>
            </button>
          ) : (
            <div className="selected-media">
              <div className="media-preview">
                {file.type.startsWith("image/") ? <img src={preview} alt="معاينة المحتوى" /> : <video src={preview} controls preload="metadata" />}
              </div>
              <div className="media-details"><strong>{file.name}</strong><small>{(file.size / 1024 / 1024).toFixed(1)} MB · {file.type}</small></div>
              <button type="button" className="icon-button danger-ghost" aria-label="إزالة الملف" onClick={() => setFile(null)}><Trash2 size={18} /></button>
            </div>
          )}

          <div className="field-grid">
            <label className="field full-field" htmlFor="title"><span>عنوان المحتوى</span><input id="title" required maxLength={140} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="عنوان واضح يساعدك في إدارة السجل" /><small>{title.length}/140</small></label>
            <label className="field full-field" htmlFor="caption"><span>الكابشن</span><textarea id="caption" rows={6} maxLength={5000} value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="اكتب الرسالة الأساسية هنا..." /><small>{caption.length}/5000</small></label>
            <label className="field full-field" htmlFor="hashtags"><span>الهاشتاجات</span><input id="hashtags" value={hashtags} onChange={(event) => setHashtags(event.target.value)} placeholder="#YANSYTech  #DigitalProducts" /><small>افصل بينها بمسافة</small></label>
          </div>
        </section>

        <aside className="compose-side">
          <section className="panel compose-step">
            <div className="form-section-title compact"><span>02</span><div><h2>منصات النشر</h2><p>اختر حسابًا واحدًا أو أكثر.</p></div></div>
            <div className="platform-selector">
              {connections.map((connection) => {
                const active = selected.includes(connection.platform);
                return (
                  <button
                    key={connection.platform}
                    className={`platform-choice ${active ? "selected" : ""}`}
                    type="button"
                    aria-pressed={active}
                    onClick={() => togglePlatform(connection.platform)}
                  >
                    <PlatformIcon platform={connection.platform} />
                    <span><strong>{platformMeta[connection.platform].name}</strong><small>{connection.connected ? connection.accountName : "سيحاول النشر بعد الربط"}</small></span>
                    <span className="choice-check">{active && <Check size={14} />}</span>
                  </button>
                );
              })}
            </div>
            {selected.includes("youtube") && (
              <label className="field mini-field" htmlFor="youtubePrivacy"><span>خصوصية YouTube</span><select id="youtubePrivacy" value={youtubePrivacy} onChange={(event) => setYoutubePrivacy(event.target.value as typeof youtubePrivacy)}><option value="private">خاص</option><option value="unlisted">غير مدرج</option><option value="public">عام</option></select></label>
            )}
          </section>

          <section className="panel compose-step">
            <div className="form-section-title compact"><span>03</span><div><h2>موعد النشر</h2><p>الآن أو في وقت تحدده.</p></div></div>
            <div className="segmented-control" role="group" aria-label="موعد النشر">
              <button type="button" className={publishMode === "now" ? "active" : ""} onClick={() => setPublishMode("now")}><Send size={16} /> نشر الآن</button>
              <button type="button" className={publishMode === "scheduled" ? "active" : ""} onClick={() => setPublishMode("scheduled")}><CalendarClock size={16} /> جدولة</button>
            </div>
            {publishMode === "scheduled" && (
              <label className="field mini-field" htmlFor="scheduledAt"><span>التاريخ والوقت</span><input id="scheduledAt" type="datetime-local" required value={scheduledAt} min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)} onChange={(event) => setScheduledAt(event.target.value)} /></label>
            )}
          </section>

          <button className="publish-button" type="submit" disabled={submitting}>
            {submitting ? <><LoaderCircle className="spin" size={19} /> جاري التجهيز...</> : publishMode === "now" ? <><Send size={19} /> ابدأ النشر</> : <><CalendarClock size={19} /> حفظ الجدولة</>}
          </button>
          <p className="publish-note"><CheckCircle2 size={15} /> كل منصة تسجل نتيجتها بشكل مستقل.</p>
        </aside>
      </form>
    </div>
  );
}

function PostsView({ posts, loading, refresh, notify }: { posts: PostRecord[]; loading: boolean; refresh: () => Promise<void>; notify: (message: string, type?: "success" | "error") => void }) {
  const [busyId, setBusyId] = useState<string | null>(null);

  async function retry(id: string) {
    setBusyId(id);
    try { await api.retryPost(id); notify("اكتملت محاولة النشر الجديدة"); await refresh(); }
    catch (error) { notify(error instanceof Error ? error.message : "تعذر إعادة النشر", "error"); }
    finally { setBusyId(null); }
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
      <PageHeader eyebrow="السجل التشغيلي" title="كل منشور وحالته." copy="راجع ما نُشر، ما ينتظر موعده، وما يحتاج تدخلًا منك." action={<button className="secondary-button" onClick={() => void refresh()}><RefreshCw size={17} /> تحديث</button>} />
      <section className="panel posts-panel">
        <div className="panel-heading"><div><span className="section-kicker">المحتوى</span><h2>{posts.length.toLocaleString("ar-EG")} منشور</h2></div></div>
        {loading ? <div className="post-skeletons"><span /><span /><span /><span /></div> : posts.length ? (
          <div className="post-list full-list">
            {posts.map((post) => (
              <PostRow
                post={post}
                key={post.id}
                actions={
                  <div className="row-actions">
                    {(post.status === "failed" || post.status === "partial") && <button className="icon-button" disabled={busyId === post.id} aria-label="إعادة النشر" onClick={() => void retry(post.id)}>{busyId === post.id ? <LoaderCircle className="spin" size={17} /> : <RefreshCw size={17} />}</button>}
                    <button className="icon-button danger-ghost" disabled={busyId === post.id} aria-label="حذف" onClick={() => void remove(post.id)}><Trash2 size={17} /></button>
                  </div>
                }
              />
            ))}
          </div>
        ) : <EmptyState icon={<History size={24} />} title="لا يوجد سجل نشر بعد" copy="أول محتوى تنشئه سيظهر هنا بنتيجة كل منصة." />}
      </section>
    </div>
  );
}

function ConnectionsView({ connections, refresh, notify }: { connections: Connection[]; refresh: () => Promise<void>; notify: (message: string, type?: "success" | "error") => void }) {
  const [busy, setBusy] = useState<Platform | null>(null);

  async function connect(platform: Platform) {
    setBusy(platform);
    try {
      const { url } = await api.authorizationUrl(platform);
      window.location.href = url;
    } catch (error) {
      notify(error instanceof Error ? error.message : "تعذر بدء الربط", "error");
      setBusy(null);
    }
  }

  async function disconnect(platform: Platform) {
    setBusy(platform);
    try { await api.disconnect(platform); await refresh(); notify("تم فصل الحساب"); }
    catch (error) { notify(error instanceof Error ? error.message : "تعذر فصل الحساب", "error"); }
    finally { setBusy(null); }
  }

  return (
    <div className="view-stack">
      <PageHeader eyebrow="إعداد مرة واحدة" title="اربط حساباتك بأمان." copy="البرنامج يستخدم الربط الرسمي لكل منصة ويحفظ رموز الوصول مشفرة على سيرفرك." />
      <section className="connections-grid">
        {connections.map((connection) => (
          <article className={`connection-card ${connection.connected ? "is-connected" : ""}`} key={connection.platform}>
            <div className="connection-card-top">
              <PlatformIcon platform={connection.platform} size="large" />
              <span className={connection.connected ? "connection-status connected" : connection.configured ? "connection-status ready" : "connection-status needs-config"}>
                {connection.connected ? "متصل" : connection.configured ? "جاهز للربط" : "يحتاج مفاتيح"}
              </span>
            </div>
            <h2>{platformMeta[connection.platform].name}</h2>
            <p>{platformMeta[connection.platform].subline}</p>
            <div className="connection-account">
              <small>{connection.connected ? "الحساب الحالي" : "حالة الإعداد"}</small>
              <strong>{connection.connected ? connection.accountName : connection.configured ? "المفاتيح موجودة" : "أضف المفاتيح في server/.env"}</strong>
            </div>
            {connection.connected
              ? <button className="disconnect-button" disabled={busy === connection.platform} onClick={() => void disconnect(connection.platform)}>{busy === connection.platform ? <LoaderCircle className="spin" size={17} /> : <X size={17} />} فصل الحساب</button>
              : <button className="connect-button" disabled={busy === connection.platform} onClick={() => void connect(connection.platform)}>{busy === connection.platform ? <LoaderCircle className="spin" size={17} /> : <Link2 size={17} />} ربط {platformMeta[connection.platform].name}</button>}
          </article>
        ))}
      </section>
      <section className="setup-note">
        <span><Settings2 size={21} /></span>
        <div><h3>ما الذي تحتاجه قبل الربط؟</h3><p>أنشئ تطبيق Developer في المنصة المطلوبة، ضع الـClient ID والـSecret داخل <code dir="ltr">server/.env</code>، ثم ارجع واضغط ربط. كلمات سر حساباتك لا تدخل إلى البرنامج.</p></div>
      </section>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState<View>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  function notify(message: string, type: "success" | "error" = "success") {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 4800);
  }

  async function loadData(silent = false) {
    if (!silent) setLoading(true);
    try {
      const [dashboardData, postsData, connectionData] = await Promise.all([api.dashboard(), api.posts(), api.connections()]);
      setDashboard(dashboardData);
      setPosts(postsData.posts);
      setConnections(connectionData.connections);
    } catch (error) {
      notify(error instanceof Error ? error.message : "تعذر تحميل البيانات", "error");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const connectionError = params.get("connectionError");
    if (connected) { setView("connections"); notify(`تم ربط ${platformMeta[connected as Platform]?.name ?? connected} بنجاح`); }
    if (connectionError) { setView("connections"); notify(connectionError, "error"); }
    if (connected || connectionError) window.history.replaceState({}, "", window.location.pathname);
    const interval = window.setInterval(() => void loadData(true), 15_000);
    return () => window.clearInterval(interval);
  }, []);

  function navigate(next: View) {
    setView(next);
    setSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function onCreated() {
    await loadData(true);
    navigate("posts");
  }

  return (
    <div className="app-shell">
      <div className={`mobile-overlay ${sidebarOpen ? "visible" : ""}`} onClick={() => setSidebarOpen(false)} />
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-head"><Brand /><button className="sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="إغلاق القائمة"><X size={20} /></button></div>
        <nav className="main-nav" aria-label="التنقل الرئيسي">
          <span className="nav-label">مساحة العمل</span>
          {navItems.map((item) => {
            const Icon = item.icon;
            return <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => navigate(item.id)}><Icon size={19} /><span>{item.label}</span>{view === item.id && <i />}</button>;
          })}
        </nav>
        <div className="sidebar-progress">
          <div className="progress-icon"><Rocket size={19} /></div>
          <strong>ربط المنصات</strong>
          <p>{connections.filter((item) => item.connected).length} من 4 حسابات جاهزة</p>
          <div className="progress-track"><span style={{ width: `${connections.filter((item) => item.connected).length * 25}%` }} /></div>
          <button onClick={() => navigate("connections")}>متابعة الإعداد <ChevronLeft size={15} /></button>
        </div>
        <footer className="sidebar-footer"><span className="avatar">YT</span><div><strong>YANSY Tech</strong><small>مساحة خاصة</small></div><MoreHorizontal size={18} /></footer>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="menu-button" onClick={() => setSidebarOpen(true)} aria-label="فتح القائمة"><Menu size={21} /></button>
          <div className="mobile-brand"><Brand /></div>
          <div className="topbar-status"><span className="system-dot" /> النظام يعمل</div>
          <button className="quick-create" onClick={() => navigate("compose")}><Plus size={17} /><span>محتوى جديد</span></button>
        </header>
        <div className="page-container">
          {view === "overview" && <Overview data={dashboard} connections={connections} loading={loading} onNavigate={navigate} />}
          {view === "compose" && <Composer connections={connections} onCreated={() => void onCreated()} notify={notify} />}
          {view === "posts" && <PostsView posts={posts} loading={loading} refresh={() => loadData(true)} notify={notify} />}
          {view === "connections" && <ConnectionsView connections={connections} refresh={() => loadData(true)} notify={notify} />}
        </div>
      </main>

      <div className={`toast ${toast?.type ?? ""} ${toast ? "visible" : ""}`} role="status" aria-live="polite">
        <span>{toast?.type === "error" ? <CircleAlert size={18} /> : <CheckCircle2 size={18} />}</span>
        <p>{toast?.message}</p>
        <button onClick={() => setToast(null)} aria-label="إغلاق التنبيه"><X size={16} /></button>
      </div>
    </div>
  );
}

