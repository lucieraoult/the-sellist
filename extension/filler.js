// Runs on Vinted / Vestiaire. If this tab was opened by The Sellist, it fills the
// listing form and shows a small panel with what was filled and copy buttons for
// the rest. It never clicks "Publier": that stays with you.
(() => {
  // SELLIST_FORCE_SITE: only set by the local mock page in test/ (content scripts can't see page globals).
  const siteId = window.SELLIST_FORCE_SITE || /vinted\./.test(location.host) ? "vinted" : /vestiairecollective\./.test(location.host) ? "vestiaire" : null;
  const SITE = siteId && window.SELLIST_SITES[siteId];
  if (!SITE) return;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
  const send = (msg) => new Promise((r) => chrome.runtime.sendMessage(msg, r));

  let job = null, results = {}, filling = false, lastPath = null;

  // ---------- reading the listing ----------
  function valueOf(f) {
    const l = job.listing;
    if (f.key === "titre") return l.titre || "";
    if (f.key === "description") return l.description || "";
    if (f.key === "prix") return l.prix === "" || l.prix == null ? "" : String(l.prix);
    const fd = (l.fields || []).find((x) => x.label === f.key);
    return fd ? translate(f.key, fd.value) : "";
  }
  function translate(key, value) {
    const lang = SITE.lang ? SITE.lang() : "fr";
    const table = SITE.translate && SITE.translate[lang] && SITE.translate[lang][key];
    if (!table || !value) return value;
    const v = norm(value);
    if (table[v]) return table[v];
    const hit = Object.keys(table).sort((a, b) => b.length - a.length).find((k) => new RegExp(`\\b${k}\\b`).test(v));
    return hit ? table[hit] : value;
  }

  // ---------- finding fields ----------
  function visible(el) {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
  }
  function descriptor(el) {
    const bits = [el.id, el.name, el.getAttribute("data-testid"), el.placeholder, el.getAttribute("aria-label")];
    if (el.id) { const lab = document.querySelector(`label[for="${CSS.escape(el.id)}"]`); if (lab) bits.push(lab.textContent); }
    const wrapLabel = el.closest("label"); if (wrapLabel) bits.push(wrapLabel.textContent);
    const lb = el.getAttribute("aria-labelledby");
    if (lb) lb.split(/\s+/).forEach((id) => { const n = document.getElementById(id); if (n) bits.push(n.textContent); });
    return bits.filter(Boolean).map(norm);
  }
  function findField(f) {
    const sel = f.kind === "textarea"
      ? "textarea, [contenteditable=true]"
      : "input:not([type=hidden]):not([type=file]):not([type=checkbox]):not([type=radio]), [role=combobox], button[aria-haspopup]";
    const els = [...document.querySelectorAll(sel)].filter(visible);
    for (const m of f.match) {
      const want = norm(m);
      // exact id / name / testid first, then "contains" anywhere in the descriptor
      const exact = els.find((el) => [el.id, el.name].map(norm).includes(want));
      if (exact) return exact;
      const loose = els.find((el) => descriptor(el).some((d) => d.includes(want)));
      if (loose) return loose;
    }
    return null;
  }

  // ---------- writing values (works with React-controlled inputs) ----------
  function setNative(el, value) {
    el.focus();
    if (el.isContentEditable) { el.textContent = value; }
    else {
      const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }
  function options() {
    return [...document.querySelectorAll('[role=option], [role=listbox] li, [role=menuitem], [data-testid*=option i], li[class*=option i]')].filter(visible);
  }
  async function pick(el, value) {
    el.scrollIntoView({ block: "center" });
    el.click();
    await sleep(350);
    if (el.tagName === "INPUT") { setNative(el, value); await sleep(700); }
    else {
      // dropdown that opens a panel with its own search box
      const search = [...document.querySelectorAll("input[type=search], input[placeholder*=recherch i], input[placeholder*=search i]")].find(visible);
      if (search) { setNative(search, value); await sleep(700); }
    }
    const want = norm(value);
    const opts = options();
    const best = opts.find((o) => norm(o.textContent) === want)
      || opts.find((o) => norm(o.textContent).startsWith(want))
      || opts.find((o) => norm(o.textContent).includes(want));
    if (!best) { document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); return false; }
    (best.querySelector("input[type=radio], input[type=checkbox]") || best).click();
    await sleep(300);
    return true;
  }

  // ---------- photos ----------
  async function toFile(src, i) {
    const blob = await (await fetch(src)).blob();
    const ext = (blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
    return new File([blob], `sellist-${i + 1}.${ext}`, { type: blob.type || "image/jpeg" });
  }
  // Photo thumbnails the site shows once an upload is accepted (blob:/data: previews or
  // anything inside the photo area). Used to check that an upload attempt really worked.
  function thumbCount(zone) {
    const scope = zone || document;
    return [...scope.querySelectorAll("img")].filter((im) => visible(im) && (/^(blob|data):/.test(im.src) || zone)).length;
  }
  // The visible photo drop area: the nearest ancestor of the file input that is a decent size.
  function dropZone(input) {
    let el = input.parentElement;
    for (let i = 0; i < 6 && el; i++, el = el.parentElement) {
      const r = el.getBoundingClientRect();
      if (r.width > 150 && r.height > 80) return el;
    }
    return input.parentElement;
  }
  async function fillPhotos() {
    const photos = job.photos || [];
    if (!photos.length) return "none";
    const inputs = [...document.querySelectorAll("input[type=file]")];
    const input = inputs.find((i) => /image/.test(i.accept || "")) || inputs[0];
    const files = [];
    for (let i = 0; i < photos.length; i++) files.push(await toFile(photos[i], i));
    const makeDT = () => { const dt = new DataTransfer(); files.forEach((f) => dt.items.add(f)); return dt; };
    const zone = input ? dropZone(input) : null;
    // "worked" = new thumbnails, or the photo area grew (some sites use background-image previews).
    // Checked before the drop fallback so the photos never get added twice.
    const nodes = () => (zone ? zone.querySelectorAll("*").length : 0);
    const before = thumbCount(zone), beforeNodes = nodes();
    const worked = async () => {
      for (let t = 0; t < 10; t++) { await sleep(400); if (thumbCount(zone) > before || nodes() > beforeNodes + 2) return true; }
      return false;
    };

    // 1) set the files on the hidden <input type=file> and fire change
    if (input) {
      input.files = makeDT().files;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      if (await worked()) return "ok";
    }
    // 2) fall back to a simulated drag-and-drop on the photo area
    const target = zone || [...document.querySelectorAll("[class*=dropzone i], [class*=upload i], [data-testid*=photo i], [data-testid*=upload i]")].find(visible);
    if (target) {
      const dt = makeDT();
      for (const type of ["dragenter", "dragover", "drop"]) {
        target.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }));
      }
      if (await worked()) return "ok";
    }
    return "manual";
  }

  // ---------- the fill pass ----------
  async function waitForForm(ms = 20000) {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      if (SITE.isForm() && document.querySelector("input, textarea")) return true;
      await sleep(400);
    }
    return false;
  }
  async function fill() {
    if (filling || !job) return;
    filling = true; results = {}; render("Remplissage en cours…");
    if (!(await waitForForm())) {
      filling = false;
      return render(`On n’a pas trouvé le formulaire. Connecte-toi à ${SITE.name} et ouvre la page de dépôt d’annonce, puis clique sur « Remplir ».`);
    }
    results.photos = await fillPhotos();
    await sleep(800); // let the uploader settle before touching other fields
    for (const f of SITE.fields) {
      const v = valueOf(f);
      if (!v) { results[f.key] = "empty"; continue; }
      if (f.kind === "info") { results[f.key] = "manual"; continue; }
      const el = findField(f);
      if (!el) { results[f.key] = "manual"; continue; }
      try {
        if (f.kind === "pick") results[f.key] = (await pick(el, v)) ? "ok" : "manual";
        else { setNative(el, v); results[f.key] = "ok"; }
      } catch (e) { results[f.key] = "manual"; }
      render("Remplissage en cours…");
    }
    filling = false;
    const todo = SITE.fields.filter((f) => results[f.key] === "manual").length;
    const photoTip = results.photos === "manual" ? " Photos : clique sur « Télécharger », puis glisse-les dans le cadre Photos du site." : "";
    render((todo ? `C’est presque prêt : ${todo} champ${todo > 1 ? "s" : ""} à choisir à la main (en orange). Vérifie tout, puis publie.` : "Tout est rempli. Vérifie l’annonce, puis publie.") + photoTip);
  }

  // ---------- panel ----------
  let host, root;
  function render(status) {
    if (!host) {
      host = document.createElement("div");
      host.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483647";
      root = host.attachShadow({ mode: "open" });
      document.documentElement.appendChild(host);
      root.addEventListener("click", onClick);
    }
    const dot = (s) => s === "ok" ? "#1E5A46" : s === "manual" ? "#C2410C" : "#9CA3AF";
    const word = (s) => s === "ok" ? "rempli" : s === "manual" ? "à toi" : s === "empty" ? "vide" : "…";
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const rows = SITE.fields.map((f, i) => {
      const v = valueOf(f); if (!v) return "";
      const s = results[f.key];
      return `<div class="row"><span class="d" style="background:${dot(s)}"></span><span class="l">${esc(f.label)}<small>${word(s)}</small></span><span class="v" title="${esc(v)}">${esc(v)}</span><button data-copy="${i}">Copier</button></div>`;
    }).join("");
    const n = (job.photos || []).length;
    const ph = n ? `<div class="row"><span class="d" style="background:${dot(results.photos)}"></span><span class="l">Photos<small>${results.photos === "ok" ? "ajoutées" : results.photos === "manual" ? "à toi" : "…"}</small></span><span class="v">${n} photo${n > 1 ? "s" : ""}</span><button data-dl>Télécharger</button></div>` : "";
    root.innerHTML = `<style>
      :host{all:initial}
      .p{font:13px/1.35 system-ui,-apple-system,sans-serif;color:#141414;background:#FBF8F3;border:1px solid #E5E0D8;border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.18);width:340px;max-height:70vh;display:flex;flex-direction:column}
      .h{display:flex;align-items:center;justify-content:space-between;padding:12px 14px 6px}
      .h b{font-size:14px}.h button{border:0;background:none;font-size:18px;cursor:pointer;color:#555}
      .s{padding:0 14px 10px;color:#444}
      .list{overflow:auto;padding:0 8px}
      .row{display:grid;grid-template-columns:10px 92px 1fr auto;gap:8px;align-items:center;padding:6px;border-top:1px solid #EEE9E1}
      .d{width:8px;height:8px;border-radius:50%}
      .l{font-weight:600;display:flex;flex-direction:column}.l small{font-weight:400;color:#777}
      .v{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#333}
      button{font:inherit;cursor:pointer}
      .row button{border:1px solid #D6D0C6;background:#fff;border-radius:8px;padding:3px 8px}
      .f{display:flex;gap:8px;padding:10px 14px 12px}
      .go{flex:1;border:0;border-radius:10px;padding:9px;background:#1E5A46;color:#fff;font-weight:600}
      .min{border:1px solid #D6D0C6;background:#fff;border-radius:10px;padding:9px 12px}
    </style>
    <div class="p">
      <div class="h"><b>The Sellist · ${esc(SITE.name)}</b><button data-close aria-label="Fermer">×</button></div>
      <div class="s">${esc(status || "")}</div>
      <div class="list">${ph}${rows}</div>
      <div class="f"><button class="go" data-fill>Remplir à nouveau</button><button class="min" data-done>Terminé</button></div>
    </div>`;
  }
  async function onClick(e) {
    const b = e.target.closest("button"); if (!b) return;
    if (b.hasAttribute("data-close")) { host.remove(); host = null; return; }
    if (b.hasAttribute("data-fill")) return fill();
    if (b.hasAttribute("data-done")) { await send({ type: "CLEAR_JOB" }); host.remove(); host = null; job = null; return; }
    if (b.hasAttribute("data-dl")) {
      (job.photos || []).forEach((src, i) => { const a = document.createElement("a"); a.href = src; a.download = `sellist-${i + 1}.jpg`; a.click(); });
      return;
    }
    if (b.dataset.copy != null) {
      const v = valueOf(SITE.fields[+b.dataset.copy]);
      try { await navigator.clipboard.writeText(v); b.textContent = "Copié"; setTimeout(() => (b.textContent = "Copier"), 1200); } catch (_) {}
    }
  }

  // ---------- boot ----------
  async function loadJob() {
    for (let i = 0; i < 10 && !job; i++) { job = await send({ type: "GET_JOB" }); if (!job) await sleep(300); }
    return job;
  }
  async function maybeFill() {
    if (location.pathname === lastPath) return;
    lastPath = location.pathname;
    if (!job && !(await loadJob())) return;
    if (SITE.isForm()) fill(); else render(`Connecte-toi à ${SITE.name} si besoin, puis ouvre le dépôt d’annonce : on remplira tout seul.`);
  }
  maybeFill();
  setInterval(maybeFill, 1000); // both sites are single-page apps: watch for route changes
})();
