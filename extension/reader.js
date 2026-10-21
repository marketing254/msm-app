// Functions that run INSIDE a Google / Bing / Yelp / Yellow Pages tab (injected with chrome.scripting.executeScript).
// Each must be self-contained: no outside variables, plain return values only.

/** State of a Google page: captcha, 403 block, consent screen, or normal. */
function readPageState() {
  const text = (document.body?.innerText || "").slice(0, 600);
  const url = location.href;
  if (url.includes("/sorry/") || /unusual traffic from your computer network/i.test(text)) return "captcha";
  if (/403\. That.s an error|does not have permission to get URL/i.test(text)) return "blocked";
  for (const t of ["Accept all", "I agree", "Accept"]) {
    const b = [...document.querySelectorAll("button")].find((x) => (x.innerText || "").trim().toLowerCase() === t.toLowerCase());
    if (b) { b.click(); return "consent"; }
  }
  return "ok";
}

/**
 * Organic results on a Google results page, in order: [{href, title, method}].
 * Three readers, because Google's markup differs between sessions:
 *  1. result link that contains the <h3> title,
 *  2. <h3> title plus the web address Google prints under it (works when every link goes through google.com),
 *  3. website links in page order, skipping AI Overview, ads, map pack, People also ask, navigation.
 */
function readOrganicResults() {
  const unwrap = (href) => {
    try {
      const u = new URL(href);
      if (/google\./.test(u.hostname) && u.pathname === "/url") return u.searchParams.get("q") || u.searchParams.get("url") || "";
      return href;
    } catch { return ""; }
  };
  const isExternal = (href) => { try { const h = new URL(href).hostname; return /^https?:/i.test(href) && !/(^|\.)google\.|googleadservices|doubleclick|gstatic|youtube\.com\/redirect/.test(h); } catch { return false; } };
  const root = document.querySelector("#rso") || document.querySelector("#search") || document.querySelector("#center_col") || document.querySelector("[role=main]") || document.body;
  const ADS = "#tads, #tadsb, [data-text-ad], [aria-label='Ads'], [aria-label='Sponsored'], .commercial-unit-desktop-top, g-scrolling-carousel, [jscontroller][data-initq]";

  const out = [];
  for (const a of root.querySelectorAll("a[href]")) {
    const titleEl = a.querySelector("h3, [role=heading]");
    if (!titleEl || a.closest(ADS)) continue;
    const href = unwrap(a.href);
    if (!isExternal(href)) continue;
    out.push({ href, title: (titleEl.innerText || "").trim(), method: "title" });
  }
  if (out.length >= 3) return out;

  const NOISE = /^(Choose what|Search Results|Customi[sz]ed date|Web results|Page navigation|Next|Footer links|Share|People also ask|Related searches|Things to know|Images|Videos|Short videos|Top stories|Places|Discussions)/i;
  const byTitle = [];
  for (const h of root.querySelectorAll("h3, [role=heading]")) {
    const title = (h.innerText || "").replace(/\s+/g, " ").trim();
    if (!title || NOISE.test(title) || h.closest(ADS)) continue;
    let el = h, href = "";
    for (let i = 0; el && el !== root && i < 8 && !href; i++) {
      el = el.parentElement; if (!el) break;
      const link = [...el.querySelectorAll("a[href]")].map((a) => unwrap(a.href)).find(isExternal);
      if (link) { href = link; break; }
      const cite = el.querySelector("cite");
      const m = ((cite && cite.innerText) || el.innerText || "").replace(/\s+/g, " ").match(/https?:\/\/([a-z0-9-]+\.)+[a-z]{2,}(\/[^\s›]*)?/i);
      if (m) href = m[0].replace(/[›…]+$/, "");
    }
    if (href) byTitle.push({ href, title, method: "title+address" });
  }
  if (byTitle.length >= 3) return byTitle;

  const SKIP = /^(AI Overview|AI Mode|Sponsored|Ads?\b|People also ask|People also search|Places|Businesses|Map|Locations|Images|Videos|Short videos|Top stories|Related searches|Things to know|Discussions and forums|Perspectives|What people are saying)/i;
  const BUTTON = /^(Website|Directions|Call|Save|Share|More|Read more|Learn more|Book|Book online|Order|Menu|Reviews?)$/i;
  const main = document.querySelector("#center_col") || document.querySelector("#rcnt") || document.querySelector("[role=main]") || document.body;
  const skipped = (a) => {
    if (a.closest(`header, footer, nav, [role=navigation], [role=banner], [role=contentinfo], ${ADS}`)) return true;
    let el = a.parentElement;
    for (let i = 0; el && el !== main && i < 14; i++, el = el.parentElement) {
      const label = el.getAttribute("aria-label") || "";
      if (SKIP.test(label)) return true;
      const t = (el.innerText || "").trim();
      if (t.length > 0 && t.length < 6000 && SKIP.test(t.slice(0, 40))) return true;
    }
    return false;
  };
  const generic = [];
  for (const a of main.querySelectorAll("a[href]")) {
    const href = unwrap(a.href);
    if (!isExternal(href)) continue;
    const text = (a.innerText || "").replace(/\s+/g, " ").trim();
    if (text.length < 8 || BUTTON.test(text)) continue;
    if (skipped(a)) continue;
    generic.push({ href, title: text.split(/ (?:https?:\/\/|www\.|›)/)[0].slice(0, 120), method: "page order" });
  }
  return [generic, byTitle, out].sort((a, b) => b.length - a.length)[0];
}

/** Compact description of a page that could not be read, for fixing the reader. */
function readPageStructure() {
  const heads = [...document.querySelectorAll("h1, h2, h3, [role=heading]")].map((h) => (h.innerText || "").replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 25);
  const raw = [...document.querySelectorAll("h3")].slice(0, 4).map((h) => { let el = h; for (let i = 0; i < 4 && el && !el.querySelector("a[href]"); i++) el = el.parentElement; const a = el?.querySelector("a[href]"); return `${(h.innerText || "").slice(0, 40)} => ${a ? a.getAttribute("href")?.slice(0, 140) : "no anchor"}`; });
  const ids = ["rso", "search", "center_col", "rcnt", "main"].filter((i) => document.getElementById(i));
  return `url=${location.href.slice(0, 120)}\nids=${ids.join(",")} anchors=${document.querySelectorAll("a[href]").length} h3=${document.querySelectorAll("h3").length}\nHEADINGS: ${heads.join(" | ")}\nRESULT LINKS:\n${raw.join("\n")}\nTEXT: ${(document.body?.innerText || "").replace(/\s+/g, " ").slice(0, 1500)}`;
}

/** Visible text of the page, trimmed. */
function readPageText(max) {
  return { url: location.href, title: document.title, text: (document.body?.innerText || "").replace(/\s+/g, " ").slice(0, max || 7000) };
}

/**
 * Small bar at the top of the search tab: what is running, how far it is, and a Pause button.
 * Pause writes {paused:true} to extension storage; the runner watches for it.
 */
function showOverlay(info) {
  let bar = document.getElementById("msm-rank-helper-bar");
  if (!bar) {
    bar = document.createElement("div"); bar.id = "msm-rank-helper-bar";
    bar.setAttribute("style", "position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#1F3A5F;color:#fff;font:13px/1.4 Inter,'Segoe UI',system-ui,Arial,sans-serif;padding:8px 14px;display:flex;align-items:center;gap:14px;box-shadow:0 2px 10px rgba(0,0,0,.25)");
    bar.innerHTML = `<b style="font-weight:600">MSM Rank Helper</b><span id="msm-rh-text" style="flex:1"></span>
      <span style="width:180px;height:6px;background:rgba(255,255,255,.25);border-radius:3px;overflow:hidden"><i id="msm-rh-fill" style="display:block;height:100%;width:0;background:#7FD1C3;transition:width .3s"></i></span>
      <span id="msm-rh-count" style="min-width:70px;text-align:right;font-variant-numeric:tabular-nums"></span>
      <button id="msm-rh-pause" style="background:#fff;color:#1F3A5F;border:0;border-radius:6px;padding:5px 12px;font:600 12.5px Inter,'Segoe UI',system-ui,sans-serif;cursor:pointer">Pause</button>`;
    document.documentElement.appendChild(bar);
    document.documentElement.style.scrollPaddingTop = "40px";
    bar.querySelector("#msm-rh-pause").onclick = () => { chrome.storage.local.set({ paused: true }); bar.querySelector("#msm-rh-text").textContent = "Pausing after this page. Resume from the MSM Rank Helper tab."; };
  }
  bar.querySelector("#msm-rh-text").textContent = info.text || "";
  bar.querySelector("#msm-rh-count").textContent = info.total ? `${info.done} of ${info.total}` : "";
  bar.querySelector("#msm-rh-fill").style.width = info.total ? `${Math.round((info.done / info.total) * 100)}%` : "0";
  return true;
}

/** First result link on a Google page that points at the given site (for "name city site:facebook.com"). */
function readFirstLinkTo(site) {
  const unwrap = (href) => { try { const u = new URL(href); if (/google\./.test(u.hostname) && u.pathname === "/url") return u.searchParams.get("q") || u.searchParams.get("url") || ""; return href; } catch { return ""; } };
  for (const a of document.querySelectorAll("a[href]")) {
    const h = unwrap(a.href);
    if (h.includes(site) && !/google\./.test(h)) return h;
  }
  const m = (document.body?.innerText || "").match(new RegExp(`https?://(www\\.)?${site.replace(".", "\\.")}[^\\s›]*`, "i"));
  return m ? m[0] : "";
}
