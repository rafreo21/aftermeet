chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "aftermeet-capture") return;
  sendResponse(window.aftermeetCapturePage());
});
