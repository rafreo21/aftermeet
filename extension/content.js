(function preloadLinkedInExperience() {
  if (!/linkedin\.com\/in\//i.test(window.location.href)) return;
  const publicId = window.aftermeetLinkedInPublicId?.(window.location.href);
  if (!publicId || typeof window.aftermeetPrefetchLinkedInExperience !== "function") return;
  window.aftermeetPrefetchLinkedInExperience(publicId);
})();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "aftermeet-capture") return;
  void window.aftermeetCapturePage().then(sendResponse);
  return true;
});
