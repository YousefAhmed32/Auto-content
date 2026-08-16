import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Vitest لا يسجّل afterEach كـglobal تلقائيًا (بخلاف Jest)، لذا يفشل التنظيف التلقائي في
// @testing-library/react بصمت بدون هذا الملف - ما يترك DOM من اختبار سابق يتراكم مع التالي
// ويسبب أخطاء "multiple elements found" عند وجود أكثر من render() في نفس الملف.
afterEach(() => {
  cleanup();
});
