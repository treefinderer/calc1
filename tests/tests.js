// Tally Calculator test suite. Loads ../index.html into a same-origin iframe with fetch and audio mocked
// (no network, no sound), drives it through DOM events and writes a summary to #test-results.
// tests/run.sh reads that summary from headless Chrome; opening /tests/ in a browser shows the same report.
(function () {
  "use strict";
  const $results = document.getElementById("test-results");
  const $log = document.getElementById("log");
  const $stage = document.getElementById("stage");
  const STORE = /^tally-/;

  // --- Fixtures ---
  const BERLIN = { name: "Berlin", admin1: "Land Berlin", country: "Germany", latitude: 52.52, longitude: 13.41, timezone: "Europe/Berlin" };
  const GEO = {
    results: [BERLIN, { name: "Bern", admin1: "Bern", country: "Switzerland", latitude: 46.95, longitude: 7.45, timezone: "Europe/Zurich" }]
  };
  const forecast = f => ({
    current: { temperature_2m: f ? 70.3 : 21.3, apparent_temperature: f ? 68.2 : 20.1, weather_code: 2, wind_speed_10m: f ? 7.2 : 11.6, is_day: 1 },
    daily: { temperature_2m_max: [f ? 74.1 : 23.4], temperature_2m_min: [f ? 54 : 12.2] }
  });
  const NEWS = {
    status: "ok",
    items: [
      { title: "Summit opens in Geneva", link: "https://www.bbc.co.uk/news/world-1", pubDate: "2026-10-22 08:00:00",
        description: '<img src=x onerror="window.__xss=1">Hello <b>world</b>', thumbnail: "", enclosure: {} },
      { title: "Bad link", link: "javascript:window.__xss=2", pubDate: "2026-10-22 07:00:00", description: "Skipped" },
      { title: "Averyveryverylongunbrokenheadlinewordthatwouldwidenthepageonphonesifitdidnotwrapproperly", link: "https://www.bbc.co.uk/news/world-2",
        pubDate: "2026-10-22 06:00:00", description: "Second story" }
    ]
  };

  // --- Mocks, called from inside the page by the script injected below ---
  const mock = { calls: [], failNews: false, plays: 0, errors: [] };
  window.TallyTest = {
    // Returns the reply body as JSON text, or null for a network failure.
    respond(url) {
      mock.calls.push(url);
      if (url.startsWith("https://geocoding-api.open-meteo.com/")) return JSON.stringify(GEO);
      if (url.startsWith("https://api.open-meteo.com/v1/forecast")) return JSON.stringify(forecast(url.includes("temperature_unit=fahrenheit")));
      if (url.startsWith("https://api.rss2json.com/") && !mock.failNews) return JSON.stringify(NEWS);
      return null;
    },
    play() { mock.plays++; },
    error(msg) { mock.errors.push(msg); }
  };
  const INJECT = `<base href="../"><script>
(function () {
  var T = parent.TallyTest;
  window.addEventListener("error", function (e) { T.error("error: " + e.message); });
  window.addEventListener("unhandledrejection", function (e) { T.error("unhandledrejection: " + ((e.reason && e.reason.message) || e.reason)); });
  var consoleError = console.error;
  console.error = function () { T.error("console.error: " + Array.prototype.join.call(arguments, " ")); return consoleError.apply(console, arguments); };
  window.fetch = function (url) {
    var text = T.respond(String(url));
    if (text === null) return Promise.reject(new TypeError("Failed to fetch (mocked)"));
    return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(JSON.parse(text)); } });
  };
  HTMLMediaElement.prototype.play = function () { T.play(); return Promise.resolve(); };
  HTMLMediaElement.prototype.pause = function () {};
  HTMLMediaElement.prototype.load = function () {};
  // Stream URLs are stored, never loaded.
  Object.defineProperty(HTMLMediaElement.prototype, "src", {
    configurable: true,
    get: function () { return this.__src || ""; },
    set: function (v) { this.__src = String(v); }
  });
})();
<\/script>`;

  // --- Page driver ---
  let pageSrc = "";
  let win = null, doc = null;
  const $ = id => doc.getElementById(id);
  const wait = ms => new Promise(r => setTimeout(r, ms));
  // Loads a fresh copy of the page at the given width; resolves once its scripts ran and mocked replies settled.
  function loadPage(width) {
    return new Promise(resolve => {
      $stage.textContent = "";
      const f = document.createElement("iframe");
      f.title = "Page under test";
      f.style.width = width + "px";
      f.addEventListener("load", () => { win = f.contentWindow; doc = f.contentDocument; wait(150).then(resolve); }, { once: true });
      f.srcdoc = pageSrc;
      $stage.appendChild(f);
    });
  }
  const key = (target, k) => target.dispatchEvent(new win.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
  function type(input, text) {
    input.value = text;
    input.dispatchEvent(new win.Event("input", { bubbles: true }));
  }
  const KEY_IDS = { "+": "k-add", "-": "k-sub", "*": "k-mul", "/": "k-div", "=": "k-eq", "%": "k-pct", "~": "k-sign", "<": "k-back", "C": "k-clear", ".": "k-dot" };
  function press(seq) { for (const ch of seq) $(KEY_IDS[ch] || "k-" + ch).click(); }
  const display = () => $("main").textContent;
  const callsTo = prefix => mock.calls.filter(u => u.startsWith(prefix));
  const forecastCalls = () => callsTo("https://api.open-meteo.com/v1/forecast");
  const newsFeeds = () => callsTo("https://api.rss2json.com/").map(u => new URL(u).searchParams.get("rss_url"));
  function clearStore() {
    Object.keys(localStorage).filter(k => STORE.test(k)).forEach(k => localStorage.removeItem(k));
  }

  // --- Checks ---
  const checks = [];
  let group = "";
  function ok(name, cond, detail) {
    const pass = !!cond;
    checks.push({ group, name, pass, detail });
    const li = document.createElement("li");
    li.className = pass ? "pass" : "fail";
    li.textContent = (pass ? "PASS " : "FAIL ") + name + (pass || !detail ? "" : " (" + detail + ")");
    $log.appendChild(li);
  }
  function eq(name, actual, expected) {
    ok(name, actual === expected, "got " + JSON.stringify(actual) + ", expected " + JSON.stringify(expected));
  }

  // --- Groups ---
  async function calculator() {
    await loadPage(1280);
    press("2+3*4=");
    eq("2 + 3 × 4 = 14 (order of operations)", display(), "14");
    const lines = doc.querySelectorAll("#tape .tape-entry");
    ok("= prints a tape line with expression and result, examples dropped", lines.length === 1 &&
      lines[0].querySelector(".tape-expr").textContent === "2 + 3 × 4" && lines[0].querySelector(".tape-result").textContent === "14",
      lines.length + " lines: " + (lines[0] && lines[0].textContent));
    ok("tape saved in tally-tape-v1", (JSON.parse(localStorage.getItem("tally-tape-v1")) || []).some(t => t.result === "14"));
    press("C2400-15%=");
    eq("2,400 − 15% = 2,040", display(), "2,040");
    press("C5/0=");
    eq("÷ 0 shows a message", display(), "Can't divide by zero");
    press("C7~");
    eq("AC clears the error, ± makes the entry negative", display(), "−7");
    press("C123<");
    eq("⌫ deletes the last digit", display(), "12");
    const typingLabel = $("k-clear").textContent;
    key(doc.body, "Escape");
    ok("Esc clears the entry; clear key reads C while typing, AC after", display() === "0" && typingLabel === "C" && $("k-clear").textContent === "AC",
      display() + " " + typingLabel + "/" + $("k-clear").textContent);
    ["9", "*", "9", "Enter"].forEach(k => key(doc.body, k));
    eq("keyboard 9 * 9 Enter = 81", display(), "81");
    key(doc.body, "Escape");
    doc.querySelector("#tape .tape-entry").click();
    eq("clicking a tape line brings back its result", display(), "14");
    press("+1=");
    eq("the reused result calculates (14 + 1 = 15)", display(), "15");
  }

  async function radio() {
    await loadPage(1280);
    eq("radio waits for the visitor", $("muteBtn").textContent, "Play");
    const input = $("wxInput");
    input.click();
    key(input, "b");
    type(input, "b");
    eq("clicks and typing in Weather don't start the radio", mock.plays, 0);
    $("newsTab-technology").click();
    key($("newsTab-technology"), "ArrowRight");
    eq("clicks and keys in News don't start the radio", mock.plays, 0);
    press("5");
    ok("a calculator key starts the radio", mock.plays === 1 && $("radioStatus").textContent === "Tuning in…", mock.plays + " plays");
    $("muteBtn").click();
    press("6");
    ok("Mute mutes and later keys don't restart it", $("muteBtn").getAttribute("aria-pressed") === "true" &&
      $("muteBtn").textContent === "Unmute" && mock.plays === 1, $("muteBtn").textContent + ", " + mock.plays + " plays");
  }

  async function weather() {
    await loadPage(1280);
    ok("first visit shows the city search", !$("wxSearch").hidden && $("wxView").hidden);
    const input = $("wxInput");
    input.focus();
    ["7", "+", "Enter"].forEach(k => key(input, k));
    type(input, "B");
    await wait(400);
    eq("one letter doesn't search", callsTo("https://geocoding-api.open-meteo.com/").length, 0);
    type(input, "Be");
    await wait(400);
    const geo = callsTo("https://geocoding-api.open-meteo.com/");
    ok("two letters search Open-Meteo geocoding", geo.length === 1 && geo[0].includes("name=Be"), geo.join(" "));
    const opts = doc.querySelectorAll("#wxResults .wx-option");
    ok("matching cities are listed", !$("wxResults").hidden && opts.length === 2 && opts[0].textContent === "Berlin, Land Berlin, Germany",
      opts.length + " options");
    key(input, "ArrowDown");
    const highlighted = opts[0] && opts[0].getAttribute("aria-selected") === "true";
    key(input, "Enter");
    await wait(150);
    ok("Down + Enter picks the first city", highlighted && $("wxSearch").hidden && !$("wxView").hidden && $("wxCity").textContent === "Berlin");
    eq("weather renders (temperature, label)", $("wxTemp").textContent + " " + $("wxCond").textContent, "21°C Partly cloudy");
    const stored = JSON.parse(localStorage.getItem("tally-weather-v1") || "null");
    ok("city stored in tally-weather-v1", stored && stored.name === "Berlin" && stored.latitude === 52.52, JSON.stringify(stored));
    eq("typing in the search box leaves the calculator alone", display(), "0");
    await loadPage(1280);
    ok("reload restores the city and its weather", !$("wxView").hidden && $("wxCity").textContent === "Berlin" && $("wxTemp").textContent === "21°C");
    $("wxUnits").querySelector('[data-unit="f"]').click();
    await wait(150);
    const fc = forecastCalls();
    ok("°F requests temperature_unit=fahrenheit", fc.length && fc[fc.length - 1].includes("temperature_unit=fahrenheit"), fc[fc.length - 1]);
    eq("°F reading shows", $("wxTemp").textContent, "70°F");
    $("wxForget").click();
    ok("Forget city clears storage and shows the search", localStorage.getItem("tally-weather-v1") === null && !$("wxSearch").hidden && $("wxView").hidden);
  }

  async function news() {
    await loadPage(1280);
    const tabs = Array.from(doc.querySelectorAll("#newsTabs [role=tab]"));
    ok("five category tabs in a tablist", $("newsTabs").getAttribute("role") === "tablist" &&
      tabs.map(t => t.textContent).join("|") === "Politics|Technology|Science|Stock Market|Sports");
    ok("each tab controls its tabpanel", tabs.every(t => {
      const p = $(t.getAttribute("aria-controls"));
      return p && p.getAttribute("role") === "tabpanel" && p.getAttribute("aria-labelledby") === t.id;
    }));
    const sel = () => tabs.map(t => t.getAttribute("aria-selected") + "/" + t.tabIndex).join(" ");
    eq("Politics selected first, others out of the tab order", sel(), "true/0 false/-1 false/-1 false/-1 false/-1");
    const feeds = newsFeeds();
    ok("first load fetches only the Politics (BBC World) feed",
      feeds.length === 1 && feeds[0] === "https://feeds.bbci.co.uk/news/world/rss.xml", feeds.join(" "));
    const panel = $("newsPanel-politics");
    ok("stories render, javascript: item skipped", panel.querySelectorAll(".news-item").length === 2 &&
      !Array.from(doc.querySelectorAll("a")).some(a => /^\s*javascript:/i.test(a.getAttribute("href") || "")), panel.textContent);
    const summary = panel.querySelector(".news-summary");
    ok("HTML description shows as plain text", summary && summary.textContent === "Hello world" && !panel.querySelector("img, b"),
      summary && summary.innerHTML);
    await wait(100);
    eq("description markup never runs", win.__xss, undefined);
    const tech = $("newsTab-technology");
    tabs[0].focus();
    key(tabs[0], "ArrowRight");
    ok("ArrowRight selects Technology, shows its panel and moves focus", sel() === "false/-1 true/0 false/-1 false/-1 false/-1" &&
      !$("newsPanel-technology").hidden && panel.hidden && doc.activeElement === tech, sel());
    ["5", "+", "Enter"].forEach(k => key(tech, k));
    eq("keys on the tabs leave the calculator alone", display(), "0");
    eq("selected tab stored in tally-news-tab-v1", localStorage.getItem("tally-news-tab-v1"), '"technology"');
    key(tech, "End");
    key(tabs[4], "ArrowLeft");
    await wait(150);
    mock.calls = [];
    await loadPage(1280);
    eq("End then ArrowLeft lands on Stock Market, restored after reload", $("newsTab-stocks").getAttribute("aria-selected"), "true");
    eq("reload fetches only that feed", newsFeeds().join(" "), "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=15839069");
    mock.failNews = true;
    $("newsTab-science").click();
    await wait(150);
    const science = $("newsPanel-science");
    const err = science.querySelector(".news-error p");
    ok("a failed load shows the error with Try again",
      err && err.textContent === "Couldn't load the headlines." && science.querySelector(".news-retry"), science.textContent);
    mock.failNews = false;
    const retry = science.querySelector(".news-retry");
    if (retry) retry.click();
    await wait(150);
    eq("Try again recovers", science.querySelectorAll(".news-item").length, 2);
  }

  async function layout() {
    localStorage.setItem("tally-weather-v1", JSON.stringify(BERLIN));
    await loadPage(375);
    const de = doc.documentElement;
    ok("no sideways scroll at 375px", de.scrollWidth <= de.clientWidth, "scrollWidth " + de.scrollWidth + " > clientWidth " + de.clientWidth);
    $("wxChange").click();
    type($("wxInput"), "Be");
    await wait(400);
    ok("no sideways scroll at 375px with city results open", !$("wxResults").hidden && de.scrollWidth <= de.clientWidth,
      "scrollWidth " + de.scrollWidth + ", clientWidth " + de.clientWidth);
    await loadPage(1280);
    const [w, c, t] = [".weather", ".calc", ".tape"].map(s => doc.querySelector(s).getBoundingClientRect());
    ok("at 1280px weather, calculator and tape sit side by side",
      Math.abs(w.top - c.top) < 2 && Math.abs(c.top - t.top) < 2 && w.right <= c.left && c.right <= t.left,
      [w, c, t].map(r => Math.round(r.left) + "–" + Math.round(r.right) + "@" + Math.round(r.top)).join(", "));
  }

  // --- Runner ---
  const GROUPS = [["Calculator", calculator], ["Radio", radio], ["Weather", weather], ["News", news], ["Layout", layout]];

  async function run() {
    const saved = {};
    Object.keys(localStorage).filter(k => STORE.test(k)).forEach(k => { saved[k] = localStorage.getItem(k); });
    try {
      pageSrc = (await (await fetch("../index.html", { cache: "no-store" })).text())
        // Offline: no web fonts (the fallback stacks apply).
        .replace(/<link[^>]+fonts\.(googleapis|gstatic)\.com[^>]*>/g, "")
        .replace(/<head>/i, "<head>" + INJECT);
      for (const [name, fn] of GROUPS) {
        group = name;
        const h = document.createElement("li");
        h.className = "group";
        h.textContent = name;
        $log.appendChild(h);
        clearStore();
        Object.assign(mock, { calls: [], failNews: false, plays: 0 });
        try { await fn(); } catch (e) { ok("group ran to the end", false, e && e.stack ? e.stack.split("\n")[0] : String(e)); }
      }
      group = "Console";
      eq("no uncaught errors or console errors", mock.errors.join(" | "), "");
    } catch (e) {
      group = "Setup";
      ok("test page loaded", false, String(e));
    }
    $stage.textContent = "";
    clearStore();
    Object.keys(saved).forEach(k => localStorage.setItem(k, saved[k]));
    const failed = checks.filter(c => !c.pass);
    const passed = checks.length - failed.length;
    $results.textContent = failed.map(c => "FAIL [" + c.group + "] " + c.name + (c.detail ? ": " + c.detail : "")).join("\n") +
      (failed.length ? "\n" : "") +
      (failed.length ? "RESULT: FAIL " + passed + "/" + checks.length + " (" + failed.length + " failed)" : "RESULT: PASS " + passed + "/" + checks.length);
  }
  run();
})();
