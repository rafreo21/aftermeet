chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "aftermeet-capture") return;
  void window.aftermeetCapturePage().then(sendResponse);
  return true;
});
