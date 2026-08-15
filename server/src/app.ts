import { existsSync } from "node:fs";
import path from "node:path";
import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import helmet from "helmet";
import morgan from "morgan";
import { apiRouter } from "./routes.js";
import { config } from "./config.js";

export const app = express();

app.disable("x-powered-by");
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: config.clientOrigin, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
if (config.nodeEnv !== "test") app.use(morgan("tiny"));

app.use("/api/media", express.static(config.uploadsDir, {
  fallthrough: false,
  immutable: true,
  maxAge: "7d"
}));
app.use("/api", apiRouter);

function legalPage(title: string, body: string) {
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} | YANSY Publish</title><style>body{margin:0;background:#f7f9fc;color:#101828;font-family:Tahoma,Arial,sans-serif;line-height:1.9}main{width:min(760px,calc(100% - 32px));margin:48px auto;padding:clamp(24px,5vw,52px);background:#fff;border:1px solid #e4e9f0;border-radius:22px;box-sizing:border-box}a{color:#2563eb}h1{font-size:clamp(28px,5vw,42px);margin:0 0 8px}h2{font-size:19px;margin-top:28px}p,li{color:#475467;font-size:14px}.brand{color:#2563eb;font-weight:700;letter-spacing:.08em}.date{font-size:12px;color:#98a2b3}</style></head><body><main><div class="brand" dir="ltr">YANSY PUBLISH</div><h1>${title}</h1><p class="date">آخر تحديث: ${new Date().toISOString().slice(0, 10)}</p>${body}<h2>التواصل</h2><p>لأي استفسار: <a href="mailto:${config.contactEmail}">${config.contactEmail}</a></p></main></body></html>`;
}

app.get("/privacy", (_request, response) => response.type("html").send(legalPage("سياسة الخصوصية", `
  <p>YANSY Publish أداة خاصة لإدارة المحتوى ونشره على الحسابات التي يربطها المستخدم بإرادته.</p>
  <h2>البيانات التي نعالجها</h2><ul><li>ملفات المحتوى والعناوين والنصوص ومواعيد الجدولة.</li><li>معرّفات الحسابات ورموز الوصول التي توفرها المنصات بعد موافقة المستخدم.</li><li>نتائج عمليات النشر وروابط المحتوى المنشور.</li></ul>
  <h2>الاستخدام والحماية</h2><p>تستخدم البيانات فقط لتنفيذ النشر وإدارة السجل. تحفظ رموز الوصول مشفرة على خادم مالك النظام ولا تباع البيانات أو تستخدم للإعلانات.</p>
  <h2>الحذف</h2><p>يمكن فصل أي منصة من شاشة الحسابات. ويمكن طلب حذف البيانات من صفحة <a href="/data-deletion">تعليمات حذف البيانات</a>.</p>`)));

app.get("/data-deletion", (_request, response) => response.type("html").send(legalPage("تعليمات حذف البيانات", `
  <p>يمكنك حذف ربط المنصة فورًا من داخل YANSY Publish عبر: الحسابات ← اختيار المنصة ← فصل الحساب.</p>
  <p>لحذف سجل المحتوى وملفاته من الخادم، احذف العناصر من شاشة سجل النشر. ولطلب حذف كامل للبيانات، أرسل رسالة من البريد المرتبط بمالك النظام إلى العنوان أدناه مع كتابة «طلب حذف بيانات YANSY Publish».</p>`)));

app.get("/terms", (_request, response) => response.type("html").send(legalPage("شروط الخدمة", `
  <p>YANSY Publish أداة خاصة لإعداد المحتوى وجدولته ونشره على حسابات التواصل الاجتماعي التي يربطها مالك الحساب بإرادته.</p>
  <h2>الاستخدام المصرح به</h2><p>يجب استخدام الخدمة فقط مع الحسابات والصفحات والمواد التي تملكها أو لديك صلاحية قانونية لإدارتها. أنت مسؤول عن المحتوى الذي ترفعه أو تجدوله أو تنشره.</p>
  <h2>قواعد المنصات</h2><p>يعتمد النشر على واجهات برمجة تطبيقات تابعة لمنصات خارجية مثل Meta وTikTok وGoogle وYouTube. يجب الالتزام بشروط وسياسات كل منصة وقواعد المحتوى الخاصة بها.</p>
  <h2>الإتاحة</h2><p>تقدم الخدمة كما هي لإدارة عمليات النشر. قد تؤثر حدود واجهات API أو حالة مراجعة التطبيق أو صلاحيات الحسابات أو أعطال المنصات على قدرة النشر.</p>
  <h2>البيانات والأمان</h2><p>تخزن رموز الوصول بغرض النشر على الحسابات المتصلة فقط. يمكنك فصل الحسابات أو طلب حذف البيانات من خلال تعليمات حذف البيانات المنشورة.</p>`)));

if (existsSync(config.clientDistDir)) {
  app.use(express.static(config.clientDistDir));
  app.get("/{*path}", (_request, response) => {
    response.sendFile(path.join(config.clientDistDir, "index.html"));
  });
}

app.use((_request, response) => response.status(404).json({ message: "المسار غير موجود" }));

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  const status = Number(error?.status ?? (error?.code === "LIMIT_FILE_SIZE" ? 413 : 500));
  const message = error?.code === "LIMIT_FILE_SIZE"
    ? `حجم الملف أكبر من الحد المسموح (${Math.round(config.maxUploadBytes / 1024 / 1024)}MB)`
    : error instanceof Error ? error.message : "حدث خطأ غير متوقع";
  if (status >= 500) console.error(error);
  response.status(status).json({ message });
};
app.use(errorHandler);
