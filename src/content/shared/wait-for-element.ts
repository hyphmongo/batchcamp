import { addBreadcrumb } from "@/shared/error-handler";

export const waitForElement = (
  selector: string,
  label?: string,
  timeoutMs = 60_000,
): Promise<Element> => {
  const existing = document.querySelector(selector);
  if (existing) {
    return Promise.resolve(existing);
  }

  return new Promise((resolve, reject) => {
    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) {
        clearTimeout(timer);
        observer.disconnect();
        addBreadcrumb({
          category: "content.init",
          message: `${label ?? selector} found via observer (late render)`,
          level: "info",
        });
        resolve(el);
      }
    });

    const timer = setTimeout(() => {
      observer.disconnect();
      reject(new Error(`${label ?? selector} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    observer.observe(document.body, { childList: true, subtree: true });
  });
};
