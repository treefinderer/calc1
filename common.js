// Shared helpers for the calculator page, exposed on window.Tally for calc.js, weather.js and news.js.
(function () {
  const WX_TIMEOUT_MS = 15000;

  // fetch that gives up after WX_TIMEOUT_MS and treats non-OK replies as failures.
  function fetchJSON(url) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), WX_TIMEOUT_MS);
    return fetch(url, { signal: ctrl.signal })
      .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .finally(() => clearTimeout(timer));
  }

  function hhmm(d) {
    return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }

  // Like fetchJSON, but a timer fails the request after `ms` even if fetch never settles.
  // A reply that arrives after that is ignored.
  function fetchJSONWithin(url, ms) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("Timed out")), ms);
    });
    return Promise.race([Promise.resolve().then(() => fetchJSON(url)), timeout])
      .finally(() => clearTimeout(timer));
  }

  window.Tally = { fetchJSON, fetchJSONWithin, hhmm };
})();
