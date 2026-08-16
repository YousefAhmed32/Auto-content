import { ArrowLeft, BarChart3, CalendarClock, CheckCircle2, ChevronLeft, CircleAlert, FileImage, Plus, UploadCloud } from "lucide-react";
import { EmptyState, PageHeader, PlatformIcon, platformMeta } from "../components/shared";
import { PostRow } from "../posts/PostRow";
import type { Connection, DashboardData, View } from "../types";

export function Overview({ data, connections, loading, onNavigate }: {
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
        copy="ارفع مرة واحدة، خصّص لكل منصة، وانشر على حساباتك بدون تكرار نفس الخطوات."
        action={<button className="primary-button" onClick={() => onNavigate("compose")}><Plus size={18} /> محتوى جديد</button>}
      />

      <section className="overview-hero">
        <div className="hero-copy">
          <span className="hero-label"><span className="pulse-dot" /> جاهز لاستقبال محتوى جديد</span>
          <h2>من الملفات إلى كل منصة،<br /><em>بمسار واحد واضح.</em></h2>
          <p>اختر حسابات النشر، خصّص المحتوى لكل واحد منها، وانشر الآن أو في الموعد المناسب.</p>
          <button className="hero-action" onClick={() => onNavigate("compose")}>ابدأ منشورًا جديدًا <ArrowLeft size={18} /></button>
        </div>
        <div className="distribution-visual" aria-hidden="true">
          <div className="signal-lines line-one" />
          <div className="signal-lines line-two" />
          <div className="center-node"><UploadCloud size={27} /><span>وسائط متعددة</span></div>
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
