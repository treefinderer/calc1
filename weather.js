(function () {
  const { fetchJSON, hhmm } = window.Tally;

  // Weather: Open-Meteo city search and current weather. The picked city and the unit are remembered.
  const WX_KEY = "tally-weather-v1";
  const WX_UNITS_KEY = "tally-weather-units-v1";
  const WX_REFRESH_MS = 15 * 60 * 1000;
  const $wx = document.getElementById("weather");
  const $wxUnits = document.getElementById("wxUnits");
  const $wxSearch = document.getElementById("wxSearch");
  const $wxInput = document.getElementById("wxInput");
  const $wxResults = document.getElementById("wxResults");
  const $wxSearchMsg = document.getElementById("wxSearchMsg");
  const $wxCancelRow = document.getElementById("wxCancelRow");
  const $wxView = document.getElementById("wxView");
  const $wxCity = document.getElementById("wxCity");
  const $wxPlace = document.getElementById("wxPlace");
  const $wxLoading = document.getElementById("wxLoading");
  const $wxError = document.getElementById("wxError");
  const $wxNow = document.getElementById("wxNow");
  const $wxIcon = document.getElementById("wxIcon");
  const $wxDetails = document.getElementById("wxDetails");
  const $wxUpdated = document.getElementById("wxUpdated");
  const $wxStale = document.getElementById("wxStale");
  const $wxStoreNote = document.getElementById("wxStoreNote");
  const $wxLive = document.getElementById("wxLive");

  let wxCity = loadCity();      // the city on show (null while there is none)
  let wxUnit = loadUnit();      // "c" or "f"
  let wxData = null;            // last successful reading for wxCity
  let wxReq = 0;                // newest forecast request; older replies are ignored
  let wxTimer = null;
  let searchReq = 0;            // newest search request; older replies are ignored
  let searchTimer = null;
  let results = [];
  let active = -1;
  let lastPointer = null;       // pointer position over the results list, to tell real moves from layout shifts

  function loadCity() {
    try {
      const c = JSON.parse(localStorage.getItem(WX_KEY));
      if (c && typeof c.name === "string" && c.name &&
          typeof c.latitude === "number" && isFinite(c.latitude) &&
          typeof c.longitude === "number" && isFinite(c.longitude)) {
        return {
          name: c.name, admin1: typeof c.admin1 === "string" ? c.admin1 : "",
          country: typeof c.country === "string" ? c.country : "",
          latitude: c.latitude, longitude: c.longitude,
          timezone: typeof c.timezone === "string" ? c.timezone : ""
        };
      }
    } catch (e) {}
    return null;
  }
  function saveCity(c) {
    try { localStorage.setItem(WX_KEY, JSON.stringify(c)); return true; } catch (e) { return false; }
  }
  function forgetStoredCity() {
    try { localStorage.removeItem(WX_KEY); } catch (e) {}
  }
  function loadUnit() {
    try {
      const u = localStorage.getItem(WX_UNITS_KEY);
      if (u === "f" || u === '"f"') return "f";
    } catch (e) {}
    return "c";
  }
  function saveUnit(u) {
    try { localStorage.setItem(WX_UNITS_KEY, JSON.stringify(u)); } catch (e) {}
  }

  function placeLine(c) { return [c.admin1, c.country].filter(Boolean).join(", "); }
  function resultLabel(c) { return [c.name, c.admin1, c.country].filter(Boolean).join(", "); }

  // WMO weather codes: [label, icon group]
  const WMO = {
    0: ["Clear", "sun"], 1: ["Mainly clear", "sun"], 2: ["Partly cloudy", "partly"], 3: ["Overcast", "cloud"],
    45: ["Fog", "fog"], 48: ["Fog", "fog"],
    51: ["Drizzle", "rain"], 53: ["Drizzle", "rain"], 55: ["Drizzle", "rain"],
    56: ["Freezing drizzle", "rain"], 57: ["Freezing drizzle", "rain"],
    61: ["Rain", "rain"], 63: ["Rain", "rain"], 65: ["Rain", "rain"],
    66: ["Freezing rain", "rain"], 67: ["Freezing rain", "rain"],
    71: ["Snow", "snow"], 73: ["Snow", "snow"], 75: ["Snow", "snow"], 77: ["Snow grains", "snow"],
    80: ["Rain showers", "rain"], 81: ["Rain showers", "rain"], 82: ["Rain showers", "rain"],
    85: ["Snow showers", "snow"], 86: ["Snow showers", "snow"],
    95: ["Thunderstorm", "thunder"], 96: ["Thunderstorm with hail", "thunder"], 99: ["Thunderstorm with hail", "thunder"]
  };
  const CLOUD = '<path class="cloud" d="M14 34h21a8 8 0 0 0 0-16 11 11 0 0 0-21-1 8.5 8.5 0 0 0 0 17z"/>';
  const SUN = '<circle class="sun" cx="24" cy="24" r="8"/><path class="ray" d="M36 24h5M7 24h5M24 12V7M24 41v-5M32.5 15.5 36 12M15.5 15.5 12 12M32.5 32.5 36 36M15.5 32.5 12 36"/>';
  const MOON = '<path class="moon" d="M28 9a15 15 0 1 0 12 22A12 12 0 0 1 28 9z"/>';
  const ICONS = {
    cloud: CLOUD,
    partly: '<circle class="sun" cx="16" cy="16" r="8"/><g transform="translate(3 6)">' + CLOUD + "</g>",
    partlyNight: '<path class="moon" d="M17 5a11 11 0 1 0 9 16A9 9 0 0 1 17 5z"/><g transform="translate(3 6)">' + CLOUD + "</g>",
    fog: '<path class="fog" d="M9 16h30M6 23h36M10 30h28M14 37h20"/>',
    rain: '<g transform="translate(0 -4)">' + CLOUD + '</g><path class="drop" d="M18 37l-2 6M26 37l-2 6M34 37l-2 6"/>',
    snow: '<g transform="translate(0 -4)">' + CLOUD + '</g><circle class="flake" cx="17" cy="39" r="2.2"/><circle class="flake" cx="25" cy="43" r="2.2"/><circle class="flake" cx="33" cy="39" r="2.2"/>',
    thunder: '<g transform="translate(0 -4)">' + CLOUD + '</g><path class="bolt" d="M26 32l-7 9h5l-3 7 9-10h-5l3-6z"/>'
  };
  function iconSvg(group, isDay) {
    let body;
    if (group === "sun") body = isDay ? SUN : MOON;
    else if (group === "partly") body = isDay ? ICONS.partly : ICONS.partlyNight;
    else body = ICONS[group] || CLOUD;
    return '<svg viewBox="0 0 48 48" focusable="false">' + body + "</svg>";
  }

  // --- Panel states ---
  function showSearchState() {
    $wx.classList.add("searching");
    $wxView.hidden = true;
    $wxUnits.hidden = true;
    $wxSearch.hidden = false;
    $wxCancelRow.hidden = !wxCity;
    $wxInput.value = "";
    resetSearch();
  }
  function showView() {
    resetSearch();
    $wx.classList.remove("searching");
    $wxSearch.hidden = true;
    $wxView.hidden = false;
    $wxUnits.hidden = false;
    $wxCity.textContent = wxCity.name;
    $wxPlace.textContent = placeLine(wxCity);
    $wxPlace.hidden = !$wxPlace.textContent;
    renderUnits();
  }
  function setReading(stateName) {
    // stateName: "loading", "error" or "data"
    $wxLoading.hidden = stateName !== "loading";
    $wxError.hidden = stateName !== "error";
    $wxNow.hidden = $wxDetails.hidden = $wxUpdated.hidden = stateName !== "data";
    if (stateName !== "data") $wxStale.hidden = true;
  }
  function renderUnits() {
    $wxUnits.querySelectorAll(".unit-btn").forEach(b => {
      b.setAttribute("aria-pressed", String(b.dataset.unit === wxUnit));
    });
  }
  function renderWeather() {
    const d = wxData;
    const f = d.unit === "f";
    const deg = n => (typeof n === "number" && isFinite(n) ? Math.round(n) : "–") + "°";
    const info = WMO[d.code] || ["Unknown", "cloud"];
    $wxIcon.innerHTML = iconSvg(info[1], d.isDay);
    document.getElementById("wxTemp").textContent = deg(d.temp) + (f ? "F" : "C");
    document.getElementById("wxCond").textContent = info[0];
    document.getElementById("wxFeels").textContent = "Feels like " + deg(d.feels);
    document.getElementById("wxWind").textContent = "Wind " +
      (typeof d.wind === "number" && isFinite(d.wind) ? Math.round(d.wind) : "–") + (f ? " mph" : " km/h");
    document.getElementById("wxHiLo").textContent = "H " + deg(d.hi) + " / L " + deg(d.lo);
    $wxUpdated.textContent = "Updated " + hhmm(d.at);
    $wxStale.hidden = true;
    setReading("data");
  }
  function announce(text) {
    $wxLive.textContent = "";
    setTimeout(() => { $wxLive.textContent = text; }, 50);
  }

  // --- Forecast ---
  function forecastUrl(c, unit) {
    let url = "https://api.open-meteo.com/v1/forecast?latitude=" + encodeURIComponent(c.latitude) +
      "&longitude=" + encodeURIComponent(c.longitude) +
      "&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day" +
      "&daily=temperature_2m_max,temperature_2m_min&timezone=auto";
    if (unit === "f") url += "&temperature_unit=fahrenheit&wind_speed_unit=mph";
    return url;
  }
  function scheduleRefresh() {
    clearTimeout(wxTimer);
    wxTimer = setTimeout(() => { if (wxCity) loadWeather(); }, WX_REFRESH_MS);
  }
  // Fetches the weather for wxCity; onFail runs if this request fails (used to revert a unit change).
  function loadWeather(onFail) {
    const id = ++wxReq;
    const unit = wxUnit;
    scheduleRefresh();
    if (!wxData) setReading("loading");
    fetchJSON(forecastUrl(wxCity, unit)).then(res => {
      if (id !== wxReq) return;
      const cur = res && res.current;
      const day = (res && res.daily) || {};
      if (!cur || typeof cur.temperature_2m !== "number") throw new Error("Unexpected reply");
      wxData = {
        temp: cur.temperature_2m, feels: cur.apparent_temperature, code: cur.weather_code,
        wind: cur.wind_speed_10m, isDay: cur.is_day !== 0,
        hi: Array.isArray(day.temperature_2m_max) ? day.temperature_2m_max[0] : null,
        lo: Array.isArray(day.temperature_2m_min) ? day.temperature_2m_min[0] : null,
        unit: unit, at: new Date()
      };
      renderWeather();
    }).catch(() => {
      if (id !== wxReq) return;
      if (onFail) onFail();
      if (wxData) {
        $wxStale.textContent = "Couldn't update. Showing " + hhmm(wxData.at) + " data.";
        $wxStale.hidden = false;
      } else {
        setReading("error");
      }
    });
  }
  function setUnit(u) {
    if (u === wxUnit || !wxCity) return;
    const prev = wxUnit;
    wxUnit = u;
    saveUnit(u);
    renderUnits();
    // On failure, go back to the unit of the data on screen (an earlier click may have been superseded).
    loadWeather(() => {
      wxUnit = wxData ? wxData.unit : prev;
      saveUnit(wxUnit);
      renderUnits();
    });
  }

  // --- City search ---
  function setSearchMsg(text, problem) {
    $wxSearchMsg.textContent = text;
    $wxSearchMsg.classList.toggle("problem", !!problem);
  }
  function closeList() {
    $wxResults.hidden = true;
    $wxResults.textContent = "";
    results = [];
    active = -1;
    $wxInput.setAttribute("aria-expanded", "false");
    $wxInput.removeAttribute("aria-activedescendant");
  }
  function resetSearch() {
    searchReq++;
    clearTimeout(searchTimer);
    closeList();
    setSearchMsg("");
  }
  function showResults(list) {
    closeList();
    results = list;
    lastPointer = null;
    list.forEach((c, i) => {
      const li = document.createElement("li");
      li.className = "wx-option";
      li.id = "wxOpt" + i;
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", "false");
      li.dataset.index = i;
      li.textContent = resultLabel(c);
      $wxResults.appendChild(li);
    });
    $wxResults.hidden = false;
    $wxInput.setAttribute("aria-expanded", "true");
  }
  function setActive(i) {
    active = i;
    Array.from($wxResults.children).forEach((li, n) => {
      li.classList.toggle("active", n === i);
      li.setAttribute("aria-selected", String(n === i));
    });
    if (i >= 0) {
      $wxInput.setAttribute("aria-activedescendant", "wxOpt" + i);
      $wxResults.children[i].scrollIntoView({ block: "nearest" });
    } else {
      $wxInput.removeAttribute("aria-activedescendant");
    }
  }
  function queryOf(text) {
    const q = text.trim();
    return q.replace(/\s/g, "").length >= 2 ? q : null;
  }
  function runSearch(q) {
    clearTimeout(searchTimer);
    const id = ++searchReq;
    closeList();
    setSearchMsg("Searching…");
    fetchJSON("https://geocoding-api.open-meteo.com/v1/search?name=" + encodeURIComponent(q) +
      "&count=5&language=en&format=json").then(res => {
      if (id !== searchReq) return;
      const list = (res && Array.isArray(res.results) ? res.results : []).filter(c =>
        c && typeof c.name === "string" && typeof c.latitude === "number" && typeof c.longitude === "number"
      ).slice(0, 5);
      if (!list.length) { setSearchMsg("No cities found for “" + q + "”"); return; }
      setSearchMsg("");
      showResults(list);
    }).catch(() => {
      if (id !== searchReq) return;
      setSearchMsg("Couldn't search right now. Check your connection and try again.", true);
    });
  }
  function pick(c) {
    const hadFocus = $wx.contains(document.activeElement);
    wxCity = {
      name: c.name, admin1: c.admin1 || "", country: c.country || "",
      latitude: c.latitude, longitude: c.longitude, timezone: c.timezone || ""
    };
    wxData = null;
    $wxStoreNote.hidden = saveCity(wxCity);
    showView();
    loadWeather();
    if (hadFocus) $wxCity.focus();
  }

  $wxInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    const q = queryOf($wxInput.value);
    if (!q) { searchReq++; closeList(); setSearchMsg(""); return; }
    searchTimer = setTimeout(() => runSearch(q), 300);
  });
  $wxInput.addEventListener("keydown", e => {
    const open = !$wxResults.hidden && results.length > 0;
    if (e.key === "ArrowDown" && open) {
      e.preventDefault();
      setActive((active + 1) % results.length);
    } else if (e.key === "ArrowUp" && open) {
      e.preventDefault();
      setActive(active <= 0 ? results.length - 1 : active - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && active >= 0) pick(results[active]);
      else { const q = queryOf($wxInput.value); if (q) runSearch(q); }
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (open) closeList();
      else if ($wxInput.value) { $wxInput.value = ""; resetSearch(); }
      else if (wxCity) cancelChange();
    }
  });
  // Leaving the input drops a pending search so results can't reopen after focus has moved on.
  $wxInput.addEventListener("blur", () => {
    searchReq++;
    clearTimeout(searchTimer);
    closeList();
    if ($wxSearchMsg.textContent === "Searching…") setSearchMsg("");
  });
  // Keep focus in the input while choosing with the mouse.
  $wxResults.addEventListener("mousedown", e => e.preventDefault());
  // Only a real pointer move changes the highlight. Browsers also fire mouse events when the list
  // opens or scrolls under a resting pointer, so the first event after opening just records the position.
  $wxResults.addEventListener("mousemove", e => {
    const moved = lastPointer && (e.clientX !== lastPointer.x || e.clientY !== lastPointer.y);
    lastPointer = { x: e.clientX, y: e.clientY };
    if (!moved) return;
    const li = e.target.closest(".wx-option");
    if (li && +li.dataset.index !== active) setActive(+li.dataset.index);
  });
  $wxResults.addEventListener("click", e => {
    const li = e.target.closest(".wx-option");
    if (li && results[+li.dataset.index]) pick(results[+li.dataset.index]);
  });

  function cancelChange() {
    showView();
    document.getElementById("wxChange").focus();
  }
  document.getElementById("wxCancel").addEventListener("click", cancelChange);
  document.getElementById("wxChange").addEventListener("click", () => {
    showSearchState();
    $wxInput.focus();
  });
  document.getElementById("wxForget").addEventListener("click", () => {
    forgetStoredCity();
    wxCity = null;
    wxData = null;
    wxReq++;
    clearTimeout(wxTimer);
    $wxStoreNote.hidden = true;
    showSearchState();
    $wxInput.focus();
    announce("City forgotten");
  });
  document.getElementById("wxRetry").addEventListener("click", () => { if (wxCity) loadWeather(); });
  $wxUnits.addEventListener("click", e => {
    const b = e.target.closest(".unit-btn");
    if (b) setUnit(b.dataset.unit);
  });

  if (wxCity) { showView(); loadWeather(); }
  else showSearchState();
})();
