import { useState, type DragEvent } from "react";
import { Film } from "lucide-react";
import type { MediaAsset } from "../types";

/** منتقي وسائط خاص بمنصة واحدة: اختيار تشكيلة فرعية من مكتبة الوسائط الأساسية وترتيبها بالسحب. */
export function PlatformMediaPicker({ allMedia, selectedIds, onChange, maxCount }: {
  allMedia: MediaAsset[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  maxCount: number;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const base = [...allMedia].sort((a, b) => a.order - b.order);
  const selected = selectedIds.length ? selectedIds.filter((id) => base.some((item) => item.id === id)) : base.map((item) => item.id);
  const byId = new Map(base.map((item) => [item.id, item]));

  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((item) => item !== id));
    } else {
      if (selected.length >= maxCount) return;
      onChange([...selected, id]);
    }
  }

  function reorder(target: number) {
    if (dragIndex === null || dragIndex === target) { setDragIndex(null); return; }
    const next = [...selected];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(target, 0, moved!);
    setDragIndex(null);
    onChange(next);
  }

  return (
    <div className="platform-media-picker">
      <div className="platform-media-grid">
        {base.map((asset) => {
          const isSelected = selected.includes(asset.id);
          const orderIndex = selected.indexOf(asset.id);
          return (
            <button
              type="button"
              key={asset.id}
              className={`platform-media-item ${isSelected ? "selected" : ""}`}
              onClick={() => toggle(asset.id)}
              aria-pressed={isSelected}
              draggable={isSelected}
              onDragStart={() => setDragIndex(orderIndex)}
              onDragOver={(event: DragEvent) => isSelected && event.preventDefault()}
              onDrop={() => isSelected && reorder(orderIndex)}
            >
              {asset.kind === "image" ? <img src={asset.url} alt="" /> : <span className="platform-media-video"><Film size={16} /></span>}
              {isSelected && <span className="platform-media-order">{orderIndex + 1}</span>}
            </button>
          );
        })}
      </div>
      <small className="platform-media-hint">{selected.length} من {base.length} مختارة{maxCount < base.length ? ` (الحد الأقصى ${maxCount})` : ""} - اضغط لتضمين/استبعاد، واسحب لإعادة الترتيب.</small>
    </div>
  );
}

export function resolvedMediaFor(allMedia: MediaAsset[], mediaOrder: string[] | undefined) {
  if (!mediaOrder?.length) return [...allMedia].sort((a, b) => a.order - b.order);
  const byId = new Map(allMedia.map((item) => [item.id, item]));
  return mediaOrder.map((id) => byId.get(id)).filter((item): item is MediaAsset => Boolean(item));
}
