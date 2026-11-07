// Runs on The Sellist page. Lets the page know the extension is installed and
// forwards "publish" jobs to the background worker.
(() => {
  const announce = () => {
    document.documentElement.dataset.sellistExt = chrome.runtime.getManifest().version;
    window.postMessage({ source: "sellist-ext", type: "READY" }, "*");
  };
  announce();
  document.addEventListener("DOMContentLoaded", announce);

  window.addEventListener("message", (e) => {
    if (e.source !== window || !e.data || e.data.source !== "sellist-page") return;
    if (e.data.type === "PING") return announce();
    if (e.data.type !== "PUBLISH") return;
    chrome.runtime.sendMessage({ type: "PUBLISH", job: e.data.job }, (res) => {
      const err = chrome.runtime.lastError;
      window.postMessage({
        source: "sellist-ext", type: "PUBLISH_RESULT", id: e.data.id,
        ok: !err && res && res.ok, error: err ? err.message : res && res.error, sites: res && res.sites
      }, "*");
    });
  });
})();
