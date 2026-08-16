import { useState } from "react";
import { Link2, LoaderCircle, Settings2, X } from "lucide-react";
import { api } from "../api";
import { PageHeader, PlatformIcon, platformMeta } from "../components/shared";
import type { Connection, Platform } from "../types";

export function ConnectionsView({ connections, refresh, notify }: {
  connections: Connection[];
  refresh: () => Promise<void>;
  notify: (message: string, type?: "success" | "error") => void;
}) {
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
