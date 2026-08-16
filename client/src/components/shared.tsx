import type { ReactNode } from "react";
import { FaFacebookF, FaInstagram, FaTiktok, FaYoutube } from "react-icons/fa6";
import type { Platform, PostRecord } from "../types";

export const platformMeta: Record<Platform, { name: string; subline: string; icon: typeof FaFacebookF; tone: string }> = {
  facebook: { name: "Facebook", subline: "الصفحات والمنشورات", icon: FaFacebookF, tone: "facebook" },
  instagram: { name: "Instagram", subline: "الصور وReels", icon: FaInstagram, tone: "instagram" },
  tiktok: { name: "TikTok", subline: "الفيديو والصور", icon: FaTiktok, tone: "tiktok" },
  youtube: { name: "YouTube", subline: "الفيديو وShorts", icon: FaYoutube, tone: "youtube" }
};

export const statusMeta: Record<PostRecord["status"], { label: string; className: string }> = {
  draft: { label: "مسودة", className: "neutral" },
  scheduled: { label: "مجدول", className: "scheduled" },
  publishing: { label: "جاري النشر", className: "progress" },
  published: { label: "تم النشر", className: "success" },
  partial: { label: "تم جزئيًا", className: "warning" },
  failed: { label: "فشل", className: "danger" }
};

export const platformResultMeta: Record<string, { label: string; className: string }> = {
  pending: { label: "بالانتظار", className: "neutral" },
  publishing: { label: "جاري النشر", className: "progress" },
  published: { label: "تم النشر", className: "success" },
  failed: { label: "فشل", className: "danger" },
  skipped: { label: "متخطّى", className: "neutral" }
};

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand" aria-label="YANSY Publish">
      <span className="brand-mark" aria-hidden="true"><span /></span>
      {!compact && <span className="brand-copy"><strong dir="ltr">YANSY</strong><small dir="ltr">PUBLISH</small></span>}
    </div>
  );
}

export function PlatformIcon({ platform, size = "normal" }: { platform: Platform; size?: "small" | "normal" | "large" }) {
  const item = platformMeta[platform];
  const Icon = item.icon;
  return <span className={`platform-icon ${item.tone} ${size}`} aria-label={item.name}><Icon aria-hidden="true" /></span>;
}

export function StatusBadge({ status }: { status: PostRecord["status"] }) {
  const item = statusMeta[status];
  return <span className={`status-badge ${item.className}`}><span />{item.label}</span>;
}

export function PlatformResultBadge({ status }: { status: string }) {
  const item = platformResultMeta[status] ?? platformResultMeta.pending;
  return <span className={`status-badge ${item.className}`}><span />{item.label}</span>;
}

export function formatDate(value?: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export function EmptyState({ icon, title, copy, action }: { icon: ReactNode; title: string; copy: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <span className="empty-icon">{icon}</span>
      <h3>{title}</h3>
      <p>{copy}</p>
      {action}
    </div>
  );
}

export function PageHeader({ eyebrow, title, copy, action }: { eyebrow: string; title: string; copy: string; action?: ReactNode }) {
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
