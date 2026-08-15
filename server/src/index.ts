import { app } from "./app.js";
import { config } from "./config.js";
import { listPosts } from "./store.js";
import { startScheduler } from "./services/publishing.js";

const server = app.listen(config.port, () => {
  console.log(`YANSY Publish API → http://localhost:${config.port}`);
  if (config.appSecret.startsWith("development-only")) {
    console.warn("APP_SECRET غير مضبوط. استخدم قيمة قوية قبل النشر.");
  }
});

startScheduler(async () => {
  const now = Date.now();
  return (await listPosts()).filter((post) =>
    post.status === "scheduled" && post.scheduledAt && new Date(post.scheduledAt).getTime() <= now
  );
});

function shutdown() {
  server.close(() => process.exit(0));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

