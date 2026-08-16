import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  CircleAlert,
  Gauge,
  History,
  Link2,
  Menu,
  MoreHorizontal,
  Plus,
  Rocket,
  X
} from "lucide-react";
import { api } from "./api";
import { Brand } from "./components/shared";
import { Composer } from "./composer/Composer";
import { ConnectionsView } from "./connections/ConnectionsView";
import { Overview } from "./overview/Overview";
import { PostsView } from "./posts/PostsView";
import type { Connection, DashboardData, Platform, PostRecord, View } from "./types";

const navItems: Array<{ id: View; label: string; icon: typeof Gauge }> = [
  { id: "overview", label: "نظرة عامة", icon: Gauge },
  { id: "compose", label: "محتوى جديد", icon: Plus },
  { id: "posts", label: "سجل النشر", icon: History },
  { id: "connections", label: "الحسابات", icon: Link2 }
];

const platformNames: Record<Platform, string> = { facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube" };

export default function App() {
  const [view, setView] = useState<View>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [composeDraftId, setComposeDraftId] = useState<string | null>(null);
  const [composeKey, setComposeKey] = useState(0);
  const composerDirty = useRef(false);

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
    if (connected) { setView("connections"); notify(`تم ربط ${platformNames[connected as Platform] ?? connected} بنجاح`); }
    if (connectionError) { setView("connections"); notify(connectionError, "error"); }
    if (connected || connectionError) window.history.replaceState({}, "", window.location.pathname);
    const interval = window.setInterval(() => void loadData(true), 15_000);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function navigate(next: View) {
    if (view === "compose" && next !== "compose" && composerDirty.current) {
      if (!window.confirm("لديك تغييرات لم تُحفظ بعد بالكامل - هل تريد المغادرة على أي حال؟")) return;
    }
    setView(next);
    setSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startNewPost() {
    setComposeDraftId(null);
    setComposeKey((key) => key + 1);
    navigate("compose");
  }

  function editDraft(id: string) {
    setComposeDraftId(id);
    setComposeKey((key) => key + 1);
    navigate("compose");
  }

  async function onComposerDone() {
    await loadData(true);
    navigate("posts");
  }

  const connectedCount = connections.filter((item) => item.connected).length;

  return (
    <div className="app-shell">
      <div className={`mobile-overlay ${sidebarOpen ? "visible" : ""}`} onClick={() => setSidebarOpen(false)} />
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-head"><Brand /><button className="sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="إغلاق القائمة"><X size={20} /></button></div>
        <nav className="main-nav" aria-label="التنقل الرئيسي">
          <span className="nav-label">مساحة العمل</span>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => (item.id === "compose" ? startNewPost() : navigate(item.id))}>
                <Icon size={19} /><span>{item.label}</span>{view === item.id && <i />}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-progress">
          <div className="progress-icon"><Rocket size={19} /></div>
          <strong>ربط المنصات</strong>
          <p>{connectedCount} من 4 حسابات جاهزة</p>
          <div className="progress-track"><span style={{ width: `${connectedCount * 25}%` }} /></div>
          <button onClick={() => navigate("connections")}>متابعة الإعداد <ChevronLeft size={15} /></button>
        </div>
        <footer className="sidebar-footer"><span className="avatar">YT</span><div><strong>YANSY Tech</strong><small>مساحة خاصة</small></div><MoreHorizontal size={18} /></footer>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="menu-button" onClick={() => setSidebarOpen(true)} aria-label="فتح القائمة"><Menu size={21} /></button>
          <div className="mobile-brand"><Brand /></div>
          <div className="topbar-status"><span className="system-dot" /> النظام يعمل</div>
          <button className="quick-create" onClick={startNewPost}><Plus size={17} /><span>محتوى جديد</span></button>
        </header>
        <div className="page-container">
          {view === "overview" && <Overview data={dashboard} connections={connections} loading={loading} onNavigate={navigate} />}
          {view === "compose" && (
            <Composer
              key={composeKey}
              draftId={composeDraftId}
              connections={connections}
              notify={notify}
              onDone={() => void onComposerDone()}
              registerDirty={(dirty) => { composerDirty.current = dirty; }}
            />
          )}
          {view === "posts" && <PostsView posts={posts} loading={loading} refresh={() => loadData(true)} notify={notify} onEditDraft={editDraft} />}
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
