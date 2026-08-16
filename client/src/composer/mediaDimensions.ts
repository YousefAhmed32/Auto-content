/**
 * يقرأ أبعاد صورة/فيديو فعليًا في المتصفح قبل الرفع (بدون أي مكتبة خارجية) لاستخدامها
 * في تحذيرات نسبة الأبعاد المبنية على Capability Matrix. يفشل بصمت (undefined) إن تعذرت القراءة
 * حتى لا يمنع ذلك رفع الملف نفسه.
 */
export function readMediaDimensions(file: File): Promise<{ width?: number; height?: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const done = (result: { width?: number; height?: number }) => {
      URL.revokeObjectURL(url);
      resolve(result);
    };
    if (file.type.startsWith("image/")) {
      const image = new Image();
      image.onload = () => done({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => done({});
      image.src = url;
    } else if (file.type.startsWith("video/")) {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => done({ width: video.videoWidth, height: video.videoHeight });
      video.onerror = () => done({});
      video.src = url;
    } else {
      done({});
    }
  });
}
