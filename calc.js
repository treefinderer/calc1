// Calculator, tape, keyboard shortcuts and the radio.
(function () {
  const MAX_DIGITS = 12;
  const SYMBOL = { "+": "+", "-": "−", "*": "×", "/": "÷" };
  const STORE_KEY = "tally-tape-v1";

  // State: tokens alternate number-strings and operators; `entry` is what's being typed.
  let tokens = [];
  let entry = "0";
  let justEvaluated = false;
  let error = null;
  let tape = loadTape();

  const $main = document.getElementById("main");
  const $exprText = document.getElementById("exprText");
  const $opInd = document.getElementById("opIndicator");
  const $tape = document.getElementById("tape");
  const $clearKey = document.getElementById("k-clear");

  function loadTape() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    // Example lines so the tape shows what it does on first visit.
    return [
      { expr: "1,250 × 12", result: "15,000", example: true },
      { expr: "84.60 + 23.15 + 9.99", result: "117.74", example: true },
      { expr: "2,400 − 15%", result: "2,040", example: true }
    ];
  }
  function saveTape() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(tape.filter(t => !t.example))); } catch (e) {}
  }

  function formatNumber(str) {
    if (str === "" || str == null) return "";
    let neg = str.startsWith("-");
    let s = neg ? str.slice(1) : str;
    if (s.includes("e")) return (neg ? "−" : "") + s;
    let [int, dec] = s.split(".");
    int = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return (neg ? "−" : "") + int + (dec !== undefined ? "." + dec : "");
  }

  function toStr(n) {
    if (!isFinite(n)) return null;
    if (n === 0) return "0";
    const abs = Math.abs(n);
    if (abs >= 1e12 || abs < 1e-9) {
      return n.toExponential(6).replace(/\.?0+e/, "e").replace("e+", "e");
    }
    // 12 significant digits trims floating-point noise like 0.1 + 0.2.
    let s = String(parseFloat(n.toPrecision(MAX_DIGITS)));
    if (s.includes("e")) s = n.toFixed(10).replace(/\.?0+$/, "");
    return s;
  }

  // Evaluate with × ÷ before + −.
  function evaluate(list) {
    const nums = [parseFloat(list[0])];
    const ops = [];
    for (let i = 1; i < list.length; i += 2) {
      const op = list[i], n = parseFloat(list[i + 1]);
      if (op === "*" || op === "/") {
        const prev = nums.pop();
        if (op === "/" && n === 0) throw new Error("div0");
        nums.push(op === "*" ? prev * n : prev / n);
      } else {
        ops.push(op); nums.push(n);
      }
    }
    let total = nums[0];
    for (let i = 0; i < ops.length; i++) total = ops[i] === "+" ? total + nums[i + 1] : total - nums[i + 1];
    return total;
  }

  function exprString(list) {
    return list.map((t, i) => i % 2 ? SYMBOL[t] : formatNumber(t)).join(" ");
  }

  function digitCount(s) { return s.replace(/[-.]/g, "").length; }

  function render() {
    $main.classList.remove("small", "tiny", "error");
    if (error) {
      $main.textContent = error;
      $main.classList.add("error");
      $exprText.textContent = exprString(tokens) || " ";
      $opInd.textContent = " ";
    } else {
      const shown = entry === "" ? (tokens.length ? tokens[tokens.length - 2] : "0") : entry;
      const text = formatNumber(shown);
      $main.textContent = text;
      if (text.length > 13) $main.classList.add("tiny");
      else if (text.length > 10) $main.classList.add("small");
      const live = entry === "" ? tokens.slice(0, -1).concat(tokens.slice(-1)) : tokens.concat(entry);
      const showExpr = tokens.length ? exprString(live) : "";
      $exprText.textContent = showExpr || " ";
      $opInd.textContent = entry === "" && tokens.length ? SYMBOL[tokens[tokens.length - 1]] : " ";
    }
    document.querySelectorAll(".key.op").forEach(k => {
      k.classList.toggle("active", !error && entry === "" && tokens[tokens.length - 1] === k.dataset.op);
    });
    $clearKey.textContent = (entry !== "0" && entry !== "") || error ? "C" : "AC";
    $clearKey.setAttribute("aria-label", $clearKey.textContent === "C" ? "Clear entry" : "All clear");
  }

  function renderTape() {
    $tape.innerHTML = "";
    if (!tape.length) {
      const li = document.createElement("li");
      li.className = "tape-empty";
      li.textContent = "Nothing on the tape yet. Press = to print a result here.";
      $tape.appendChild(li);
      return;
    }
    tape.forEach((t, i) => {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.className = "tape-entry";
      b.type = "button";
      b.dataset.index = i;
      b.setAttribute("aria-label", `Use result ${t.result}`);
      if (t.example) {
        const tag = document.createElement("span");
        tag.className = "tape-tag"; tag.textContent = "Example";
        b.appendChild(tag);
      }
      const e = document.createElement("span"); e.className = "tape-expr"; e.textContent = t.expr;
      const r = document.createElement("span"); r.className = "tape-result"; r.textContent = t.result;
      b.append(e, r);
      li.appendChild(b);
      $tape.appendChild(li);
    });
    $tape.scrollTop = $tape.scrollHeight;
  }

  function resetIfDone() {
    if (error) { error = null; tokens = []; entry = "0"; }
    if (justEvaluated) { tokens = []; justEvaluated = false; }
  }

  function inputDigit(d) {
    if (justEvaluated) { entry = "0"; }
    resetIfDone();
    if (digitCount(entry) >= MAX_DIGITS) return;
    entry = (entry === "0" || entry === "") ? d : entry === "-0" ? "-" + d : entry + d;
  }

  function inputDot() {
    if (justEvaluated) entry = "0";
    resetIfDone();
    if (entry === "") entry = "0";
    if (!entry.includes(".")) entry += ".";
  }

  function inputOp(op) {
    if (error) return;
    justEvaluated = false;
    if (entry === "") {
      if (tokens.length) tokens[tokens.length - 1] = op;
      return;
    }
    tokens.push(trimEntry(entry), op);
    entry = "";
  }

  function trimEntry(s) {
    if (s.endsWith(".")) s = s.slice(0, -1);
    if (s === "-0" || s === "-") s = "0";
    return s;
  }

  function equals() {
    if (error || justEvaluated) return;
    let list = tokens.slice();
    if (entry === "") list.pop(); else list.push(trimEntry(entry));
    if (list.length < 3) return;
    try {
      const value = evaluate(list);
      const s = toStr(value);
      if (s === null) throw new Error("overflow");
      tape = tape.filter(t => !t.example);
      tape.push({ expr: exprString(list), result: formatNumber(s) });
      if (tape.length > 200) tape = tape.slice(-200);
      saveTape(); renderTape();
      tokens = list; entry = s; justEvaluated = true;
      // Keep the finished expression visible above the answer.
      $exprText.textContent = exprString(list) + " =";
      renderAfterEquals();
    } catch (e) {
      tokens = list; entry = "";
      error = e.message === "div0" ? "Can't divide by zero" : "Number too large";
    }
  }

  function renderAfterEquals() {
    const done = tokens;
    tokens = [];
    render();
    $exprText.textContent = exprString(done) + " =";
  }

  function clear() {
    if (error) { error = null; tokens = []; entry = "0"; justEvaluated = false; return; }
    if (entry !== "0" && entry !== "" && !justEvaluated) { entry = "0"; return; }
    tokens = []; entry = "0"; justEvaluated = false;
  }

  function back() {
    if (error) { clear(); return; }
    if (justEvaluated) { justEvaluated = false; tokens = []; return; }
    if (entry === "") return;
    entry = entry.slice(0, -1);
    if (entry === "" || entry === "-") entry = "0";
  }

  function sign() {
    if (error) return;
    if (justEvaluated) { justEvaluated = false; tokens = []; }
    if (entry === "") entry = "0";
    entry = entry.startsWith("-") ? entry.slice(1) : "-" + entry;
  }

  function percent() {
    if (error) return;
    if (justEvaluated) { justEvaluated = false; tokens = []; }
    if (entry === "") return;
    const n = parseFloat(entry);
    const op = tokens[tokens.length - 1];
    // For + and −, "200 + 10%" means 10% of 200, like a desk calculator.
    if ((op === "+" || op === "-") && tokens.length >= 2) {
      const base = evaluate(tokens.slice(0, -1));
      entry = toStr(base * n / 100) || "0";
    } else {
      entry = toStr(n / 100) || "0";
    }
  }

  function handle(action) {
    if (/^\d$/.test(action)) inputDigit(action);
    else if (action in SYMBOL) inputOp(action);
    else if (action === "dot") inputDot();
    else if (action === "equals") { equals(); if (justEvaluated) { updateClearLabel(); return; } }
    else if (action === "clear") clear();
    else if (action === "back") back();
    else if (action === "sign") sign();
    else if (action === "percent") percent();
    render();
  }

  function updateClearLabel() {
    $clearKey.textContent = "AC";
    $clearKey.setAttribute("aria-label", "All clear");
    document.querySelectorAll(".key.op").forEach(k => k.classList.remove("active"));
  }

  document.getElementById("keys").addEventListener("click", e => {
    const k = e.target.closest(".key");
    if (!k) return;
    handle(k.dataset.digit || k.dataset.op || k.dataset.action);
  });

  const KEYMAP = {
    "Enter": "equals", "=": "equals", "Escape": "clear", "Delete": "clear",
    "Backspace": "back", ".": "dot", ",": "dot", "%": "percent",
    "+": "+", "-": "-", "*": "*", "x": "*", "X": "*", "/": "/"
  };
  const keyButton = a => document.querySelector(
    /^\d$/.test(a) ? `[data-digit="${a}"]` : a in SYMBOL ? `[data-op="${CSS.escape(a)}"]` : `[data-action="${a}"]`
  );
  document.addEventListener("keydown", e => {
    // Keys typed or pressed inside the weather panel or the news belong to them, not the calculator.
    if (e.target.closest && e.target.closest("#weather, #news")) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const a = /^\d$/.test(e.key) ? e.key : KEYMAP[e.key];
    if (!a) return;
    // Let Enter/space activate a focused tape line or button normally.
    if (e.key === "Enter" && document.activeElement && document.activeElement.matches(".tape-entry, .link-btn, .mute-btn")) return;
    e.preventDefault();
    if (e.key === "Enter" && document.activeElement && document.activeElement.matches(".key")) document.activeElement.blur();
    handle(a);
    const btn = keyButton(a);
    if (btn) { btn.classList.add("pressed"); setTimeout(() => btn.classList.remove("pressed"), 90); }
  });

  $tape.addEventListener("click", e => {
    const b = e.target.closest(".tape-entry");
    if (!b) return;
    const t = tape[+b.dataset.index];
    const raw = t.result.replace(/,/g, "").replace("−", "-");
    if (error || justEvaluated) { error = null; tokens = []; justEvaluated = false; }
    entry = raw;
    render();
  });

  document.getElementById("clearTape").addEventListener("click", () => {
    tape = []; saveTape(); renderTape();
  });

  // Radio: browsers only allow sound after the visitor interacts, so it starts on the first key press or click.
  const $radio = document.getElementById("radio");
  const $audio = document.getElementById("radioAudio");
  const $radioStatus = document.getElementById("radioStatus");
  const $muteBtn = document.getElementById("muteBtn");
  const STREAMS = ["https://stream.radioparadise.com/rock-128", "https://stream.radioparadise.com/mp3-128"];
  // state: "idle" (not started yet), "loading", "playing", "muted", "failed"
  let state = "idle";
  let streamIndex = 0;
  let loadTimer = null;

  function setStatus(text) { $radioStatus.innerHTML = text; }
  function renderRadio() {
    const label = { idle: "Play", loading: "Mute", playing: "Mute", muted: "Unmute", failed: "Retry" }[state];
    $muteBtn.textContent = label;
    $muteBtn.setAttribute("aria-pressed", String(state === "muted"));
    $radio.classList.toggle("playing", state === "playing");
    const status = {
      idle: "Press Play or any key to start",
      loading: "Tuning in…",
      playing: 'Live from <a href="https://radioparadise.com/" target="_blank" rel="noopener">Radio Paradise</a>',
      muted: "Muted"
    }[state];
    if (status) setStatus(status);
  }
  function fail(message) {
    clearTimeout(loadTimer);
    $audio.pause();
    state = "failed";
    setStatus(message);
    renderRadio();
  }
  function playStream() {
    state = "loading";
    renderRadio();
    clearTimeout(loadTimer);
    // Reload the source each time so a live stream starts at the current moment.
    $audio.src = STREAMS[streamIndex];
    $audio.muted = false;
    $audio.volume = 1;
    const attempt = $audio.play();
    if (attempt && attempt.catch) {
      attempt.catch(err => {
        if (state !== "loading") return;
        if (err && err.name === "NotAllowedError") {
          state = "idle";
          setStatus("Your browser blocked sound. Press Play to start");
          $muteBtn.textContent = "Play";
        } else {
          tryNextStream();
        }
      });
    }
    loadTimer = setTimeout(() => {
      if (state === "loading") fail("Can't reach the station. Your network may block radio streams");
    }, 15000);
  }
  function tryNextStream() {
    if (streamIndex < STREAMS.length - 1) { streamIndex++; playStream(); }
    else { streamIndex = 0; fail("Can't reach the station. Your network may block radio streams"); }
  }

  $audio.addEventListener("playing", () => {
    if (state !== "loading") return;
    clearTimeout(loadTimer);
    state = "playing";
    renderRadio();
  });
  $audio.addEventListener("error", () => { if (state === "loading") tryNextStream(); });

  $muteBtn.addEventListener("click", e => {
    e.stopPropagation();
    if (state === "playing" || state === "loading") {
      clearTimeout(loadTimer);
      $audio.pause();
      state = "muted";
      renderRadio();
    } else {
      playStream();
    }
  });

  // The first click, tap or key press anywhere starts the radio. Browsers allow sound only from these events.
  function autoStart(e) {
    if (state !== "idle" || e.target === $muteBtn) return;
    if (e.target.closest && e.target.closest("#weather, #news")) return;
    playStream();
  }
  ["click", "keydown", "touchend"].forEach(type =>
    document.addEventListener(type, autoStart, { capture: true })
  );

  renderRadio();
  render();
  renderTape();
})();
