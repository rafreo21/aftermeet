(function preloadLinkedInExperience() {
  if (!/linkedin\.com\/in\//i.test(window.location.href)) return;
  const publicId = window.aftermeetLinkedInPublicId?.(window.location.href);
  if (!publicId || typeof window.aftermeetPrefetchLinkedInExperience !== "function") return;
  window.aftermeetPrefetchLinkedInExperience(publicId);
})();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "aftermeet-capture") {
    void window.aftermeetCapturePage()
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ error: String(error) }));
    return true;
  }

  if (message?.type !== "aftermeet-capture-and-finish") return undefined;

  void (async () => {
    try {
      const payload = await window.aftermeetCapturePage();
      await chrome.runtime.sendMessage({
        type: "aftermeet-finish-import",
        baseUrl: message.baseUrl,
        payload,
      });
      sendResponse({ ok: true });
    } catch (error) {
      await chrome.storage.local.set({
        aftermeetCaptureStatus: {
          state: "error",
          message: "Capture failed. Reload the extension and try again.",
          finishedAt: Date.now(),
        },
      });
      sendResponse({ ok: false, message: String(error) });
    }
  })();

  return true;
});
