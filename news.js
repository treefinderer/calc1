(function () {
  const { fetchJSONWithin, hhmm } = window.Tally;

  // News: headlines per category, fetched from public RSS feeds by a scheduled GitHub Action
  // (scripts/fetch_news.py) and served from the same site as news/<id>.json.
  const NEWS_KEY = "tally-news-tab-v1";
  const NEWS_REFRESH_MS = 15 * 60 * 1000;
  const NEWS_TIMEOUT_MS = 15000;
  const NEWS_MAX = 10;
  const NEWS_ORDER = ["politics", "technology", "science", "stocks", "sports"];
  const NEWS_SOURCES = { politics: "BBC News", technology: "BBC News", science: "BBC News", stocks: "CNBC", sports: "BBC Sport" };
  const NEWS_ERROR = "Couldn't load the headlines.";
  const NEWS_EMPTY = "No stories in this category right now.";
  const $news = document.getElementById("news");
  const $newsTabs = document.getElementById("newsTabs");
  const $newsLive = document.getElementById("newsLive");
  const newsTabEl = id => document.getElementById("newsTab-" + id);
  const newsPanelEl = id => document.getElementById("newsPanel-" + id);

  // Session cache per category: stories (null until a load succeeds), time of the last success,
  // when the server fetched those stories, whether a request is in flight, and whether the latest request failed.
  const news = {};
  NEWS_ORDER.forEach(id => { news[id] = { stories: null, at: null, updated: null, loading: false, failed: false }; });
  let newsTab = null;           // the selected category
  let newsTimer = null;         // refresh timer for the selected category only

  function loadNewsTab() {
    try {
      const id = JSON.parse(localStorage.getItem(NEWS_KEY));
      if (NEWS_ORDER.includes(id)) return id;
    } catch (e) {}
    return "politics";
  }
  function saveNewsTab(id) {
    try { localStorage.setItem(NEWS_KEY, JSON.stringify(id)); } catch (e) {}
  }

  // Returns the URL if it is http(s) (https only when asked), otherwise null.
  function webUrl(s, httpsOnly) {
    if (typeof s !== "string" || !s.trim()) return null;
    try {
      const u = new URL(s.trim());
      if (u.protocol === "https:" || (!httpsOnly && u.protocol === "http:")) return u.href;
    } catch (e) {}
    return null;
  }
  // Feed summaries are third-party text. DOMParser builds an inert document (no scripts, no image loads).
  function plainText(html) {
    if (typeof html !== "string" || !html) return "";
    return new DOMParser().parseFromString(html, "text/html").body.textContent || "";
  }
  const squash = s => s.replace(/\s+/g, " ").trim();
  function shorten(s, max) {
    if (s.length <= max) return s;
    let cut = s.slice(0, max);
    const space = cut.lastIndexOf(" ");
    if (space > max * 0.6) cut = cut.slice(0, space);
    return cut.replace(/[\s,.;:!?\-–—]+$/, "") + "…";
  }
  // Dates in news/<id>.json are ISO UTC, "YYYY-MM-DDTHH:MM:SSZ".
  function parseIsoUtc(s) {
    if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(s.trim())) return null;
    const t = Date.parse(s.trim());
    return isFinite(t) ? new Date(t) : null;
  }
  function ago(d) {
    const diff = Date.now() - d.getTime();
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return Math.floor(diff / 60000) + " min ago";
    if (diff < 86400000) return Math.floor(diff / 3600000) + " h ago";
    return Math.floor(diff / 86400000) + " d ago";
  }

  function toStories(items) {
    const out = [];
    for (const it of items) {
      if (out.length >= NEWS_MAX) break;
      if (!it || typeof it !== "object") continue;
      const title = typeof it.title === "string" ? squash(it.title) : "";
      const link = webUrl(it.link, false);
      if (!title || !link) continue;
      const thumb = webUrl(it.thumbnail, true);
      // The summary should already be plain text; parsing it again keeps stray markup inert.
      let summary = squash(plainText(it.summary));
      if (summary === title) summary = "";
      out.push({ title, link, thumb, summary: shorten(summary, 200), date: parseIsoUtc(it.pubDate) });
    }
    return out;
  }

  function storyItem(s, source) {
    const li = document.createElement("li");
    li.className = "news-item";
    if (s.thumb) {
      const img = document.createElement("img");
      img.className = "news-thumb";
      img.alt = "";
      img.width = 112; img.height = 72;
      img.setAttribute("loading", "lazy");
      img.setAttribute("decoding", "async");
      img.setAttribute("referrerpolicy", "no-referrer");
      img.addEventListener("error", () => { img.remove(); li.classList.remove("has-thumb"); });
      img.src = s.thumb;
      li.classList.add("has-thumb");
      li.appendChild(img);
    }
    const text = document.createElement("div");
    text.className = "news-text";
    const a = document.createElement("a");
    a.className = "news-link";
    a.href = s.link;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = s.title;
    const meta = document.createElement("p");
    meta.className = "news-meta";
    const src = document.createElement("span");
    src.textContent = source;
    meta.appendChild(src);
    if (s.date) {
      const t = document.createElement("time");
      t.dateTime = s.date.toISOString().replace(/\.\d{3}Z$/, "Z");
      t.textContent = ago(s.date);
      meta.append(" · ", t);
    }
    text.append(a, meta);
    if (s.summary) {
      const p = document.createElement("p");
      p.className = "news-summary";
      p.textContent = s.summary;
      text.appendChild(p);
    }
    li.appendChild(text);
    return li;
  }
  function newsMessage(cls, text, retry) {
    const box = document.createElement("div");
    box.className = cls;
    const p = document.createElement("p");
    p.textContent = text;
    box.appendChild(p);
    if (retry) {
      const b = document.createElement("button");
      b.className = "news-btn news-retry";
      b.type = "button";
      b.textContent = "Try again";
      box.appendChild(b);
    }
    return box;
  }

  const hasStories = c => !!(c.stories && c.stories.length);
  function setNewsBusy(id) {
    const c = news[id];
    newsPanelEl(id).setAttribute("aria-busy", String(c.loading && !hasStories(c)));
  }
  // Redraws one panel from its cache. Relative times are recalculated on every redraw.
  function renderNewsPanel(id) {
    const c = news[id];
    const panel = newsPanelEl(id);
    const focused = panel.contains(document.activeElement) ? document.activeElement : null;
    const focusHref = focused && focused.matches(".news-link") ? focused.href : null;
    setNewsBusy(id);
    panel.textContent = "";
    if (hasStories(c)) {
      const ul = document.createElement("ul");
      ul.className = "news-list";
      c.stories.forEach(s => ul.appendChild(storyItem(s, NEWS_SOURCES[id])));
      const updated = document.createElement("p");
      updated.className = "news-updated";
      updated.textContent = "Updated " + hhmm(c.updated);
      panel.append(ul, updated);
      if (c.failed) {
        const stale = document.createElement("p");
        stale.className = "news-note problem";
        stale.textContent = "Couldn't update. Showing headlines from " + hhmm(c.updated) + ".";
        panel.appendChild(stale);
      }
    } else if (c.loading || (!c.failed && !c.stories)) {
      const p = document.createElement("p");
      p.className = "news-loading";
      p.textContent = "Loading headlines…";
      panel.appendChild(p);
    } else if (c.failed) {
      panel.appendChild(newsMessage("news-error", NEWS_ERROR, true));
    } else {
      panel.appendChild(newsMessage("news-error", NEWS_EMPTY, true));
    }
    // Keep keyboard focus in place when a redraw replaces the focused control.
    if (focused && !panel.contains(focused)) {
      const same = focusHref && Array.from(panel.querySelectorAll(".news-link")).find(l => l.href === focusHref);
      (same || panel).focus();
    }
  }
  function newsAnnounce(text) {
    $newsLive.textContent = "";
    setTimeout(() => { $newsLive.textContent = text; }, 50);
  }

  // At most one request per category; a late reply fills the cache but only the selected panel is redrawn.
  function loadNews(id) {
    const c = news[id];
    if (c.loading) return;
    c.loading = true;
    if (id === newsTab && !hasStories(c)) renderNewsPanel(id);
    else setNewsBusy(id);
    fetchJSONWithin("news/" + id + ".json", NEWS_TIMEOUT_MS)
      .then(res => {
        if (!res || res.error === true || !Array.isArray(res.items)) throw new Error("Unexpected reply");
        c.stories = toStories(res.items);
        c.at = new Date();
        c.updated = parseIsoUtc(res.fetchedAt) || c.at;
        c.failed = false;
      })
      .catch(() => { c.failed = true; })
      .then(() => {
        c.loading = false;
        if (id !== newsTab) { setNewsBusy(id); return; }
        renderNewsPanel(id);
        if (!hasStories(c)) newsAnnounce(c.failed ? NEWS_ERROR : NEWS_EMPTY);
      });
  }
  function scheduleNews(ms) {
    clearTimeout(newsTimer);
    newsTimer = setTimeout(() => {
      loadNews(newsTab);
      scheduleNews(NEWS_REFRESH_MS);
    }, ms);
  }
  function selectNewsTab(id) {
    if (!news[id] || id === newsTab) return;
    newsTab = id;
    NEWS_ORDER.forEach(k => {
      const tab = newsTabEl(k);
      tab.setAttribute("aria-selected", String(k === id));
      tab.tabIndex = k === id ? 0 : -1;
      newsPanelEl(k).hidden = k !== id;
    });
    // Cached stories show at once; they are fetched again only when 15 minutes old or never loaded.
    const c = news[id];
    const age = c.at ? Date.now() - c.at.getTime() : Infinity;
    renderNewsPanel(id);
    if (age >= NEWS_REFRESH_MS) loadNews(id);
    scheduleNews(age >= NEWS_REFRESH_MS ? NEWS_REFRESH_MS : NEWS_REFRESH_MS - age);
  }

  $newsTabs.addEventListener("click", e => {
    const tab = e.target.closest(".news-tab");
    if (!tab) return;
    selectNewsTab(tab.dataset.cat);
    saveNewsTab(newsTab);
  });
  $newsTabs.addEventListener("keydown", e => {
    const tab = e.target.closest(".news-tab");
    if (!tab || e.metaKey || e.ctrlKey || e.altKey) return;
    const i = NEWS_ORDER.indexOf(tab.dataset.cat);
    const n = NEWS_ORDER.length;
    const next = { ArrowRight: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    selectNewsTab(NEWS_ORDER[next]);
    saveNewsTab(newsTab);
    newsTabEl(newsTab).focus();
  });
  $news.addEventListener("click", e => {
    if (!e.target.closest(".news-retry")) return;
    const panel = newsPanelEl(newsTab);
    const hadFocus = panel.contains(document.activeElement);
    loadNews(newsTab);
    if (hadFocus && !panel.contains(document.activeElement)) panel.focus();
  });

  selectNewsTab(loadNewsTab());
})();
