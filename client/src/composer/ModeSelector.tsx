import { Check, SlidersHorizontal, Zap } from "lucide-react";
import type { ContentMode } from "../types";

const MODES: Array<{ id: ContentMode; title: string; tagline: string; points: string[]; icon: typeof Zap }> = [
  {
    id: "simple",
    title: "نشر سريع",
    tagline: "أسرع طريقة للنشر",
    points: ["يدعم عدة صور", "مناسب للنشر اليومي", "إعدادات قليلة وواضحة"],
    icon: Zap
  },
  {
    id: "advanced",
    title: "نشر متقدم",
    tagline: "تحكم كامل في كل منصة",
    points: ["تخصيص منفصل لكل منصة", "إعدادات متقدمة", "معاينات تفصيلية"],
    icon: SlidersHorizontal
  }
];

/** بطاقتان واضحتان لاختيار وضع الإنشاء - مرئيتان دائمًا أعلى الـ Composer، وليستا داخل قائمة إعدادات. */
export function ModeSelector({ current, onSelect }: { current: ContentMode; onSelect: (mode: ContentMode) => void }) {
  return (
    <div className="mode-selector" role="radiogroup" aria-label="وضع إنشاء المحتوى">
      {MODES.map((mode) => {
        const Icon = mode.icon;
        const active = current === mode.id;
        return (
          <button
            key={mode.id}
            type="button"
            role="radio"
            aria-checked={active}
            className={`mode-card ${active ? "selected" : ""}`}
            onClick={() => onSelect(mode.id)}
          >
            <span className="mode-card-icon"><Icon size={20} /></span>
            <span className="mode-card-body">
              <strong>{mode.title}</strong>
              <small>{mode.tagline}</small>
              <ul>
                {mode.points.map((point) => <li key={point}>{point}</li>)}
              </ul>
            </span>
            <span className="mode-card-check" aria-hidden="true">{active && <Check size={16} />}</span>
          </button>
        );
      })}
    </div>
  );
}
