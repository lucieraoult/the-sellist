// Receives a listing job from The Sellist, opens one "new listing" tab per site,
// and hands each tab its listing when the filler script asks for it.

// Vinted accounts belong to one country site; The Sellist sends which one to use.
const VINTED_HOSTS = ["www.vinted.fr", "www.vinted.co.uk"];

const SITE_URLS = {
  vinted: "https://www.vinted.fr/items/new",
  // To verify: Vestiaire's "Déposer un article" entry point. If it moves, update it here.
  vestiaire: "https://fr.vestiairecollective.com/sell-clothes-online/"
};

// Jobs are kept in storage.local (photos can weigh a few MB), keyed by tab id.
const key = (tabId) => `job:${tabId}`;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "PUBLISH") {
    publish(msg.job).then(sendResponse, (e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  if (msg.type === "GET_JOB") {
    const k = key(sender.tab.id);
    chrome.storage.local.get(k).then((o) => sendResponse(o[k] || null));
    return true;
  }
  if (msg.type === "CLEAR_JOB") {
    chrome.storage.local.remove(key(sender.tab.id)).then(() => sendResponse(true));
    return true;
  }
});

async function publish(job) {
  if (!job || !job.listings) return { ok: false, error: "Annonce vide." };
  const sites = Object.keys(job.listings).filter((id) => SITE_URLS[id]);
  if (!sites.length) return { ok: false, error: "Ni Vinted ni Vestiaire dans la sélection." };
  const vintedHost = VINTED_HOSTS.includes(job.vintedHost) ? job.vintedHost : VINTED_HOSTS[0];
  const urlFor = (site) => (site === "vinted" ? `https://${vintedHost}/items/new` : SITE_URLS[site]);
  for (const site of sites) {
    const tab = await chrome.tabs.create({ url: urlFor(site), active: site === sites[0] });
    await chrome.storage.local.set({
      [key(tab.id)]: { site, listing: job.listings[site], fiche: job.fiche, photos: job.photos || [], at: Date.now() }
    });
  }
  return { ok: true, sites };
}

chrome.tabs.onRemoved.addListener((tabId) => chrome.storage.local.remove(key(tabId)));
