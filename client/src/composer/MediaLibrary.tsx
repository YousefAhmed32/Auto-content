import { useRef, useState, type DragEvent } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Film, GripVertical, ImagePlus, LoaderCircle, RefreshCw, Trash2, UploadCloud, X } from "lucide-react";
import { api } from "../api";
import type { MediaAsset, PostRecord } from "../types";
import { readMediaDimensions } from "./mediaDimensions";

const ACCEPTED = "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm";

interface QueueItem {
  id: string;
  name: string;
  status: "uploading" | "done" | "error";
  message?: string;
  progress: number;
}

function formatSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

export function MediaLibrary({ post, onPostUpdate, notify, compact = false }: {
  post: PostRecord;
  onPostUpdate: (post: PostRecord) => void;
  notify: (message: string, type?: "success" | "error") => void;
  /** الوضع البسيط: يخفي حقول alt text والملاحظة الداخلية ويبقي أدوات الرفع/الترتيب/الاستبدال/الحذف الأساسية فقط. */
  compact?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const replaceTargetId = useRef<string | null>(null);
  const media = [...post.media].sort((a, b) => a.order - b.order);

  /** يرفع كل ملف على حدة (لا دفعة واحدة) حتى لا يمنع فشل ملف واحد رفع باقي الملفات، ولإظهار حالة/خطأ كل ملف منفردًا. */
  async function uploadFiles(files: File[]) {
    if (!files.length) return;
    setUploading(true);
    const items: QueueItem[] = files.map((file, index) => ({
      id: `${Date.now()}-${index}-${file.name}`,
      name: file.name,
      status: "uploading",
      progress: 0
    }));
    setQueue(items);

    let successCount = 0;
    let failureCount = 0;
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index]!;
      const queueId = items[index]!.id;
      try {
        const dimensions = await readMediaDimensions(file);
        const { post: updated } = await api.uploadMedia(post.id, [file], [dimensions], (percent) => {
          setQueue((current) => current.map((item) => (item.id === queueId ? { ...item, progress: percent } : item)));
        });
        onPostUpdate(updated);
        successCount += 1;
        setQueue((current) => current.map((item) => (item.id === queueId ? { ...item, status: "done", progress: 100 } : item)));
      } catch (error) {
        failureCount += 1;
        const message = error instanceof Error ? error.message : "تعذر رفع الملف";
        setQueue((current) => current.map((item) => (item.id === queueId ? { ...item, status: "error", message } : item)));
      }
    }

    setUploading(false);
    if (successCount) notify(successCount > 1 ? `تم رفع ${successCount} ملفات` : "تم رفع الملف");
    if (failureCount) notify(`تعذر رفع ${failureCount} ${failureCount === 1 ? "ملف" : "ملفات"} - راجع السبب أسفل منطقة الرفع`, "error");
    if (!failureCount) {
      window.setTimeout(() => setQueue((current) => (current.every((item) => item.status === "done") ? [] : current)), 2000);
    }
  }

  async function replaceFile(mediaId: string, file: File) {
    setBusyId(mediaId);
    try {
      const original = post.media.find((item) => item.id === mediaId);
      const dimensions = await readMediaDimensions(file);
      const { post: afterUpload } = await api.uploadMedia(post.id, [file], [dimensions]);
      const added = afterUpload.media.find((item) => !post.media.some((existing) => existing.id === item.id));
      if (added && original) {
        const order = [...afterUpload.media].sort((a, b) => a.order - b.order).map((item) => item.id);
        const withoutOriginal = order.filter((id) => id !== original.id);
        const insertAt = order.indexOf(original.id);
        const withoutNew = withoutOriginal.filter((id) => id !== added.id);
        withoutNew.splice(Math.min(insertAt, withoutNew.length), 0, added.id);
        const { post: reordered } = await api.reorderMedia(post.id, withoutNew);
        const { post: afterRemove } = await api.removeMedia(post.id, original.id);
        onPostUpdate(afterRemove);
      } else {
        onPostUpdate(afterUpload);
      }
      notify("تم استبدال الملف");
    } catch (error) {
      notify(error instanceof Error ? error.message : "تعذر استبدال الملف", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function removeAsset(mediaId: string) {
    setBusyId(mediaId);
    try {
      const { post: updated } = await api.removeMedia(post.id, mediaId);
      onPostUpdate(updated);
    } catch (error) {
      notify(error instanceof Error ? error.message : "تعذر حذف الملف", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function updateAssetMeta(mediaId: string, patch: { altText?: string; caption?: string }) {
    try {
      const { post: updated } = await api.updateMedia(post.id, mediaId, patch);
      onPostUpdate(updated);
    } catch (error) {
      notify(error instanceof Error ? error.message : "تعذر حفظ الملاحظة", "error");
    }
  }

  async function commitOrder(nextOrder: MediaAsset[]) {
    try {
      const { post: updated } = await api.reorderMedia(post.id, nextOrder.map((item) => item.id));
      onPostUpdate(updated);
    } catch (error) {
      notify(error instanceof Error ? error.message : "تعذر حفظ الترتيب", "error");
    }
  }

  function moveAsset(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= media.length) return;
    const next = [...media];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved!);
    void commitOrder(next);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    void uploadFiles(Array.from(event.dataTransfer.files));
  }

  function onCardDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) { setDragIndex(null); return; }
    const next = [...media];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(targetIndex, 0, moved!);
    setDragIndex(null);
    void commitOrder(next);
  }

  return (
    <div className={`media-library ${compact ? "compact" : ""}`}>
      <div
        className={`upload-zone ${dragOver ? "drag-over" : ""}`}
        role="button"
        tabIndex={0}
        onClick={() => fileInput.current?.click()}
        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") fileInput.current?.click(); }}
        onDragOver={(event) => { event.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <input
          ref={fileInput}
          className="visually-hidden"
          type="file"
          accept={ACCEPTED}
          multiple
          onChange={(event) => { void uploadFiles(Array.from(event.target.files ?? [])); event.target.value = ""; }}
        />
        {uploading ? (
          <>
            <span className="upload-icon"><UploadCloud size={26} /></span>
            <strong>جاري رفع الملفات…</strong>
          </>
        ) : (
          <>
            <span className="upload-icon"><UploadCloud size={26} /></span>
            <strong>اسحب الملفات هنا أو اخترها من جهازك</strong>
            <small>صور أو فيديو - يمكن رفع عدة ملفات معًا لعمل تسلسل (Carousel)</small>
            <span className="choose-file">اختيار ملفات</span>
          </>
        )}
      </div>

      {queue.length > 0 && (
        <ul className="upload-queue" aria-label="حالة رفع الملفات">
          {queue.map((item) => (
            <li key={item.id} className={`upload-queue-item ${item.status}`}>
              <span className="upload-queue-icon">
                {item.status === "uploading" && <LoaderCircle className="spin" size={14} />}
                {item.status === "done" && <CheckCircle2 size={14} />}
                {item.status === "error" && <AlertTriangle size={14} />}
              </span>
              <span className="upload-queue-name" title={item.name}>{item.name}</span>
              {item.status === "uploading" && <span className="upload-queue-progress">{item.progress}%</span>}
              {item.status === "error" && <span className="upload-queue-message">{item.message}</span>}
              {item.status !== "uploading" && (
                <button type="button" className="upload-queue-dismiss" aria-label="إخفاء" onClick={() => setQueue((current) => current.filter((entry) => entry.id !== item.id))}>
                  <X size={12} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {media.length > 0 && (
        <div className="media-grid" role="list" aria-label="ملفات الوسائط">
          <input
            ref={replaceInput}
            className="visually-hidden"
            type="file"
            accept={ACCEPTED}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file && replaceTargetId.current) void replaceFile(replaceTargetId.current, file);
              event.target.value = "";
            }}
          />
          {media.map((asset, index) => (
            <article
              className={`media-card ${dragIndex === index ? "dragging" : ""}`}
              role="listitem"
              key={asset.id}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => onCardDrop(index)}
            >
              <header className="media-card-head">
                <span className="media-card-handle" aria-hidden="true"><GripVertical size={15} /></span>
                <span className="media-card-order">{index + 1}</span>
                {asset.kind === "video" && <span className="media-card-kind"><Film size={13} /> فيديو</span>}
              </header>
              <div className="media-card-preview">
                {asset.kind === "image"
                  ? <img src={asset.url} alt={asset.altText ?? ""} loading="lazy" />
                  : <video src={asset.url} preload="metadata" muted />}
              </div>
              <div className="media-card-body">
                <small className="media-card-name" title={asset.originalName}>{asset.originalName}</small>
                <small className="media-card-size">
                  {formatSize(asset.size)}
                  {asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ""}
                </small>
                {!compact && (
                  <>
                    <label className="field mini-field">
                      <span>نص بديل (Alt text - Instagram فقط)</span>
                      <input
                        defaultValue={asset.altText ?? ""}
                        maxLength={1000}
                        placeholder="وصف قصير للصورة لإتاحة الوصول"
                        onBlur={(event) => { if (event.target.value !== (asset.altText ?? "")) void updateAssetMeta(asset.id, { altText: event.target.value }); }}
                      />
                    </label>
                    <label className="field mini-field">
                      <span>ملاحظة داخلية (اختياري)</span>
                      <input
                        defaultValue={asset.caption ?? ""}
                        maxLength={300}
                        placeholder="مثال: صورة المكوّنات"
                        onBlur={(event) => { if (event.target.value !== (asset.caption ?? "")) void updateAssetMeta(asset.id, { caption: event.target.value }); }}
                      />
                    </label>
                  </>
                )}
              </div>
              <footer className="media-card-actions">
                <button
                  type="button"
                  className="icon-button"
                  aria-label="نقل للأعلى في الترتيب"
                  disabled={index === 0}
                  onClick={() => moveAsset(index, -1)}
                >
                  <ArrowRight size={15} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="نقل للأسفل في الترتيب"
                  disabled={index === media.length - 1}
                  onClick={() => moveAsset(index, 1)}
                >
                  <ArrowLeft size={15} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="استبدال الملف"
                  disabled={busyId === asset.id}
                  onClick={() => { replaceTargetId.current = asset.id; replaceInput.current?.click(); }}
                >
                  <RefreshCw size={15} />
                </button>
                <button
                  type="button"
                  className="icon-button danger-ghost"
                  aria-label="حذف الملف"
                  disabled={busyId === asset.id}
                  onClick={() => void removeAsset(asset.id)}
                >
                  <Trash2 size={15} />
                </button>
              </footer>
            </article>
          ))}
        </div>
      )}

      {!media.length && !uploading && (
        <p className="media-empty-hint"><AlertTriangle size={14} /> لم تُضف أي وسائط بعد - يلزم ملف واحد على الأقل للمتابعة.</p>
      )}
      {media.length > 1 && (
        <p className="media-order-hint"><ImagePlus size={14} /> اسحب البطاقات أو استخدم أزرار النقل لإعادة الترتيب - الترتيب يمثل تسلسل الظهور (مثال: غلاف ← مكوّنات ← خطوات ← النتيجة).</p>
      )}
    </div>
  );
}
