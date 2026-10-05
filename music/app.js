// Owl Beats: a one-page music generator for the Suno API (https://docs.sunoapi.org).
// Everything runs in the browser. The visitor pastes their own API key, which is
// kept in localStorage and sent only to api.sunoapi.org.
// auth.js handles email login and calls startApp() once someone is signed in.

"use strict";

const API = "https://api.sunoapi.org/api/v1";
// Suno requires a callBackUrl on every task. This page polls for results
// instead, so the callback goes to a placeholder that nobody reads.
const CALLBACK_URL = "https://example.com/suno-callback";
const POLL_MS = 5000;
const GIVE_UP_MS = 15 * 60 * 1000;

// Per-user storage keys; startApp() adds the signed-in user's id so people
// sharing a browser don't see each other's key or tracks.
let KEY_STORE = "owlbeats-api-key";
let TASK_STORE = "owlbeats-tasks";
const THEME_STORE = "owlbeats-theme";

const STYLES = [
  "Pop", "Hip-hop", "R&B", "Rock", "Indie", "EDM", "Lo-fi", "Jazz",
  "Country", "Reggaeton", "Classical", "Cinematic", "Acoustic", "Synthwave",
];

const FAILED = {
  CREATE_TASK_FAILED: "Suno could not create the task.",
  GENERATE_AUDIO_FAILED: "Suno could not generate audio for this request.",
  CALLBACK_EXCEPTION: "Suno reported an error while finishing the task.",
  SENSITIVE_WORD_ERROR: "The prompt or lyrics contain words Suno doesn't allow. Try rewording.",
};

const API_ERRORS = {
  400: "Suno rejected the request (invalid parameters).",
  401: "Your API key was rejected. Check it and try again.",
  404: "Suno couldn't find that endpoint.",
  405: "Rate limit reached. Wait a moment and try again.",
  413: "The prompt or lyrics are too long.",
  429: "You're out of Suno credits. Top up at sunoapi.org.",
  430: "Too many requests. Please try again shortly.",
  455: "Suno is under maintenance. Try again later.",
  500: "Suno had a server error. Try again.",
};

const $ = (sel) => document.querySelector(sel);
const els = {
  form: $("#form"),
  tabs: document.querySelectorAll(".tab"),
  prompt: $("#prompt"),
  title: $("#title"),
  style: $("#style"),
  chips: $("#style-chips"),
  lyrics: $("#lyrics"),
  instrumental: $("#instrumental"),
  model: $("#model"),
  vocal: $("#vocal"),
  duration: $("#duration"),
  durationOut: $("#duration-out"),
  negative: $("#negative"),
  styleWeight: $("#style-weight"),
  styleWeightOut: $("#style-weight-out"),
  weirdness: $("#weirdness"),
  weirdnessOut: $("#weirdness-out"),
  variety: $("#variety"),
  formError: $("#form-error"),
  generate: $("#generate"),
  aiToggle: $("#ai-lyrics-toggle"),
  aiBox: $("#ai-lyrics"),
  lyricsPrompt: $("#lyrics-prompt"),
  lyricsGo: $("#lyrics-go"),
  tasks: $("#tasks"),
  empty: $("#empty"),
  clearAll: $("#clear-all"),
  credits: $("#credits"),
  keyBtn: $("#key-btn"),
  keyNotice: $("#key-notice"),
  keyNoticeBtn: $("#key-notice-btn"),
  keyDialog: $("#key-dialog"),
  keyForm: $("#key-form"),
  keyInput: $("#api-key"),
  showKey: $("#show-key"),
  keyRemove: $("#key-remove"),
  keyCancel: $("#key-cancel"),
  extendDialog: $("#extend-dialog"),
  extendForm: $("#extend-form"),
  extendName: $("#extend-name"),
  extendAt: $("#extend-at"),
  extendAtOut: $("#extend-at-out"),
  extendStyle: $("#extend-style"),
  extendTitle: $("#extend-title"),
  extendLyrics: $("#extend-lyrics"),
  extendLyricsField: $("#extend-lyrics-field"),
  extendCancel: $("#extend-cancel"),
  themeToggle: $("#theme-toggle"),
  toast: $("#toast"),
};

let mode = "simple";
let tasks = [];
let extendTarget = null;
let polling = false;

// ---------- storage ----------

function store(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch { /* private mode: keep going without saving */ }
}
function read(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function loadTasks() {
  try { return JSON.parse(read(TASK_STORE)) || []; } catch { return []; }
}
function saveTasks() {
  store(TASK_STORE, JSON.stringify(tasks.slice(0, 50)));
}
const getKey = () => (read(KEY_STORE) || "").trim();

// ---------- Suno API ----------

class ApiError extends Error {}

async function suno(path, body) {
  const key = getKey();
  if (!key) {
    openKeyDialog();
    throw new ApiError("Add your Suno API key first.");
  }
  let res;
  try {
    res = await fetch(`${API}${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Couldn't reach api.sunoapi.org. Check your connection and try again.");
  }
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON error page */ }
  const code = data && typeof data.code === "number" ? data.code : res.status;
  if (!res.ok || code !== 200) {
    const msg = API_ERRORS[code] || (data && data.msg) || `Request failed (${res.status}).`;
    const detail = data && data.msg && API_ERRORS[code] && data.msg !== "success" ? ` (${data.msg})` : "";
    throw new ApiError(msg + detail);
  }
  return data.data;
}

// Suno's responses have used both snake_case and camelCase over time.
function normalizeTrack(t) {
  return {
    id: t.id,
    title: t.title || "Untitled",
    tags: t.tags || "",
    duration: Number(t.duration) || 0,
    audio: t.audio_url || t.audioUrl || t.source_audio_url || t.sourceAudioUrl || "",
    stream: t.stream_audio_url || t.streamAudioUrl || t.source_stream_audio_url || t.sourceStreamAudioUrl || "",
    image: t.image_url || t.imageUrl || t.source_image_url || t.sourceImageUrl || "",
    lyrics: t.prompt || "",
  };
}

async function refreshCredits() {
  if (!getKey()) return;
  els.credits.hidden = false;
  els.credits.textContent = "Credits: …";
  try {
    const credits = await suno("/generate/credit");
    els.credits.textContent = `Credits: ${Number(credits).toLocaleString()}`;
  } catch (err) {
    els.credits.textContent = "Credits: ?";
    els.credits.title = err.message;
  }
}

// ---------- form ----------

function setMode(next) {
  mode = next;
  els.tabs.forEach((t) => {
    const on = t.dataset.mode === mode;
    t.classList.toggle("active", on);
    t.setAttribute("aria-selected", String(on));
  });
  document.querySelectorAll(".mode-simple").forEach((el) => (el.hidden = mode !== "simple"));
  document.querySelectorAll(".mode-custom").forEach((el) => (el.hidden = mode !== "custom"));
  syncInstrumental();
  hideError();
}

function syncInstrumental() {
  const inst = els.instrumental.checked;
  if (mode === "custom") {
    $(".lyrics-field").hidden = inst;
    $(".vocal-field").hidden = inst;
  }
}

function buildRequest() {
  const style = els.style.value.trim();
  const instrumental = els.instrumental.checked;
  const model = els.model.value;

  if (mode === "simple") {
    const prompt = els.prompt.value.trim();
    if (!prompt && !style) throw new ApiError("Describe your song or pick a style.");
    if (!style) throw new ApiError("Pick a style (tap a suggestion or type your own).");
    return { customMode: false, instrumental, model, style, ...(prompt ? { prompt } : {}) };
  }

  const lyrics = instrumental ? "" : els.lyrics.value.trim();
  const negativeTags = els.negative.value.trim();
  if (!style && !lyrics && !negativeTags) throw new ApiError("Add a style or some lyrics.");
  if (!instrumental && !lyrics) {
    throw new ApiError("Add lyrics, use ✨ Write lyrics with AI, or switch on Instrumental.");
  }
  const req = {
    customMode: true,
    instrumental,
    model,
    style,
    title: els.title.value.trim(),
    duration: Number(els.duration.value),
    styleWeight: Number(els.styleWeight.value),
    weirdnessConstraint: Number(els.weirdness.value),
    variety: Number(els.variety.value),
  };
  if (!req.style) delete req.style;
  if (!req.title) delete req.title;
  if (lyrics) req.lyrics = lyrics;
  if (negativeTags) req.negativeTags = negativeTags;
  if (!instrumental && els.vocal.value) req.vocalGender = els.vocal.value;
  return req;
}

async function onGenerate(e) {
  e.preventDefault();
  hideError();
  let request;
  try {
    request = buildRequest();
  } catch (err) {
    return showError(err.message);
  }
  if (!getKey()) return openKeyDialog();

  setBusy(els.generate, true, "Sending…");
  try {
    const data = await suno("/generate", { ...request, callBackUrl: CALLBACK_URL });
    addTask({
      taskId: data.taskId,
      kind: "generate",
      label: request.title || request.prompt || request.style || "New song",
      request,
    });
    toast("Generating! Your tracks will appear on the right.");
    refreshCredits();
  } catch (err) {
    showError(err.message);
  } finally {
    setBusy(els.generate, false);
  }
}

async function onWriteLyrics() {
  const prompt = els.lyricsPrompt.value.trim();
  if (!prompt) return els.lyricsPrompt.focus();
  setBusy(els.lyricsGo, true, "Writing…");
  hideError();
  try {
    const { taskId } = await suno("/lyrics", { prompt, callBackUrl: CALLBACK_URL });
    const started = Date.now();
    while (Date.now() - started < 3 * 60 * 1000) {
      await sleep(3000);
      const info = await suno(`/lyrics/record-info?taskId=${encodeURIComponent(taskId)}`);
      if (FAILED[info.status]) throw new ApiError(FAILED[info.status]);
      const options = (info.response && info.response.data) || [];
      const done = options.find((o) => o.text && (o.status === "complete" || info.status === "SUCCESS"));
      if (done) {
        els.lyrics.value = done.text;
        if (!els.title.value && done.title) els.title.value = done.title;
        updateCounters();
        els.aiBox.hidden = true;
        toast("Lyrics ready. Edit them however you like.");
        refreshCredits();
        return;
      }
    }
    throw new ApiError("Lyrics took too long. Try again.");
  } catch (err) {
    showError(err.message);
  } finally {
    setBusy(els.lyricsGo, false);
  }
}

// ---------- tasks & polling ----------

function addTask(task) {
  tasks.unshift({ ...task, createdAt: Date.now(), status: "PENDING", tracks: [], error: "" });
  saveTasks();
  render();
  poll();
}

const isActive = (t) => !t.error && t.status !== "SUCCESS";

async function poll() {
  if (polling) return;
  polling = true;
  try {
    while (tasks.some(isActive) && getKey()) {
      for (const task of tasks.filter(isActive)) {
        await checkTask(task);
      }
      saveTasks();
      render();
      if (tasks.some(isActive)) await sleep(POLL_MS);
    }
  } finally {
    polling = false;
  }
}

async function checkTask(task) {
  if (Date.now() - task.createdAt > GIVE_UP_MS) {
    task.error = "Timed out waiting for Suno. Refresh later or try again.";
    return;
  }
  let info;
  try {
    info = await suno(`/generate/record-info?taskId=${encodeURIComponent(task.taskId)}`);
  } catch (err) {
    task.lastError = err.message; // transient: keep polling
    return;
  }
  task.lastError = "";
  task.status = info.status || task.status;
  const raw = (info.response && (info.response.sunoData || info.response.data)) || [];
  if (raw.length) task.tracks = raw.map(normalizeTrack);
  if (FAILED[task.status]) {
    // A callback error can still leave finished audio behind.
    if (task.tracks.some((t) => t.audio)) task.status = "SUCCESS";
    else task.error = info.errorMessage || FAILED[task.status];
  }
}

const STATUS_TEXT = {
  PENDING: "Queued…",
  TEXT_SUCCESS: "Writing lyrics done, composing…",
  FIRST_SUCCESS: "First version ready, finishing the second…",
  SUCCESS: "Done",
};

// ---------- rendering ----------

function render() {
  els.empty.hidden = tasks.length > 0;
  els.clearAll.hidden = tasks.length === 0;
  els.tasks.replaceChildren(...tasks.map(renderTask));
}

function renderTask(task) {
  const li = el("li", "task");
  const head = el("div", "task-head");
  const info = el("div", "task-info");
  const label = el("div", "task-label", (task.kind === "extend" ? "↪ Extension of " : "") + truncate(task.label, 90));
  const meta = el("div", "task-meta");
  const badge = el("span", "badge");
  if (task.error) {
    badge.classList.add("badge-error");
    badge.textContent = "Failed";
  } else if (task.status === "SUCCESS") {
    badge.classList.add("badge-done");
    badge.textContent = "Ready";
  } else {
    badge.classList.add("badge-working");
    badge.textContent = STATUS_TEXT[task.status] || "Working…";
  }
  meta.append(badge, el("span", "", timeAgo(task.createdAt)));
  info.append(label, meta);

  const actions = el("div", "task-actions");
  if (task.request && task.kind === "generate") {
    actions.append(button("Reuse", "link-btn", () => reuse(task.request), "Load these settings into the form"));
  }
  actions.append(button("✕", "icon-btn small", () => removeTask(task.taskId), "Remove from list"));
  head.append(info, actions);
  li.append(head);

  if (task.error) li.append(el("p", "task-error", task.error));
  else if (task.lastError) li.append(el("p", "task-warn", `Retrying: ${task.lastError}`));

  if (isActive(task) && !task.tracks.length) {
    li.append(el("div", "progress"));
  }

  if (task.tracks.length) {
    const list = el("div", "tracks");
    task.tracks.forEach((t, i) => list.append(renderTrack(task, t, i)));
    li.append(list);
  }
  return li;
}

function renderTrack(task, t, i) {
  const card = el("article", "track");
  const art = el("div", "art");
  if (t.image) {
    const img = document.createElement("img");
    img.src = t.image;
    img.alt = "";
    img.loading = "lazy";
    art.append(img);
  } else {
    art.textContent = "🎵";
  }

  const body = el("div", "track-body");
  body.append(el("h3", "track-title", `${t.title}${task.tracks.length > 1 ? ` · v${i + 1}` : ""}`));
  const sub = [t.tags, t.duration ? fmtTime(t.duration) : ""].filter(Boolean).join(" · ");
  if (sub) body.append(el("p", "track-sub", truncate(sub, 120)));

  const src = t.audio || t.stream;
  if (src) {
    const audio = document.createElement("audio");
    audio.controls = true;
    audio.preload = "none";
    audio.src = src;
    audio.addEventListener("play", () => {
      document.querySelectorAll("audio").forEach((a) => a !== audio && a.pause());
    });
    body.append(audio);
    if (!t.audio) body.append(el("p", "track-sub", "Streaming preview. The full-quality file is still finishing."));
  } else {
    body.append(el("div", "progress"));
  }

  const actions = el("div", "track-actions");
  if (t.audio) {
    const dl = el("a", "btn btn-secondary btn-sm", "⬇ MP3");
    dl.href = t.audio;
    dl.download = `${safeName(t.title)}.mp3`;
    dl.target = "_blank";
    dl.rel = "noopener";
    actions.append(dl);
    if (t.id) actions.append(button("↪ Extend", "btn btn-secondary btn-sm", () => openExtend(task, t)));
  }
  if (t.lyrics && !(task.request && task.request.instrumental)) {
    const details = document.createElement("details");
    details.className = "lyrics-view";
    const summary = document.createElement("summary");
    summary.textContent = "Lyrics";
    const pre = el("pre", "", t.lyrics);
    const copy = button("Copy", "link-btn", async () => {
      try {
        await navigator.clipboard.writeText(t.lyrics);
        toast("Lyrics copied.");
      } catch { toast("Couldn't copy. Select the text instead."); }
    });
    details.append(summary, copy, pre);
    body.append(actions, details);
  } else {
    body.append(actions);
  }
  card.append(art, body);
  return card;
}

function removeTask(taskId) {
  tasks = tasks.filter((t) => t.taskId !== taskId);
  saveTasks();
  render();
}

function reuse(req) {
  setMode(req.customMode ? "custom" : "simple");
  els.style.value = req.style || "";
  els.instrumental.checked = Boolean(req.instrumental);
  els.model.value = ["V6", "V6_WILD", "V6_MINI"].includes(req.model) ? req.model : "V6";
  if (req.customMode) {
    els.title.value = req.title || "";
    els.lyrics.value = req.lyrics || "";
    els.negative.value = req.negativeTags || "";
    els.vocal.value = req.vocalGender || "";
    if (req.duration) els.duration.value = req.duration;
    if (req.styleWeight !== undefined) els.styleWeight.value = req.styleWeight;
    if (req.weirdnessConstraint !== undefined) els.weirdness.value = req.weirdnessConstraint;
    if (req.variety !== undefined) els.variety.value = req.variety;
  } else {
    els.prompt.value = req.prompt || "";
  }
  syncInstrumental();
  updateOutputs();
  updateCounters();
  els.form.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---------- extend ----------

function openExtend(task, track) {
  extendTarget = { task, track };
  const max = Math.max(2, Math.floor(track.duration || 120) - 1);
  els.extendName.textContent = track.title;
  els.extendAt.max = max;
  els.extendAt.value = max;
  els.extendStyle.value = track.tags || (task.request && task.request.style) || "";
  els.extendTitle.value = track.title;
  els.extendLyrics.value = "";
  const instrumental = Boolean(task.request && task.request.instrumental);
  els.extendLyricsField.hidden = instrumental;
  updateOutputs();
  els.extendDialog.showModal();
}

async function onExtend(e) {
  e.preventDefault();
  if (!extendTarget) return;
  const { task, track } = extendTarget;
  const instrumental = Boolean(task.request && task.request.instrumental);
  const body = {
    audioId: track.id,
    taskId: task.taskId,
    model: (task.request && task.request.model) || "V6",
    instrumental,
    continueAt: Number(els.extendAt.value),
    style: els.extendStyle.value.trim(),
    title: els.extendTitle.value.trim(),
    callBackUrl: CALLBACK_URL,
  };
  const lyrics = els.extendLyrics.value.trim();
  if (!instrumental && lyrics) body.lyrics = lyrics;
  for (const k of ["style", "title"]) if (!body[k]) delete body[k];

  const submit = els.extendForm.querySelector('button[type="submit"]');
  setBusy(submit, true, "Sending…");
  try {
    const data = await suno("/generate/extend", body);
    els.extendDialog.close();
    addTask({
      taskId: data.taskId,
      kind: "extend",
      label: track.title,
      request: { instrumental, model: body.model, style: body.style },
    });
    toast("Extending! New versions will appear in your list.");
    refreshCredits();
  } catch (err) {
    toast(err.message, true);
  } finally {
    setBusy(submit, false);
  }
}

// ---------- API key ----------

function openKeyDialog() {
  els.keyInput.value = getKey();
  els.keyInput.type = "password";
  els.showKey.checked = false;
  els.keyRemove.hidden = !getKey();
  if (!els.keyDialog.open) els.keyDialog.showModal();
  els.keyInput.focus();
}

function syncKeyUi() {
  const has = Boolean(getKey());
  els.keyBtn.textContent = has ? "🔑 API key" : "🔑 Add API key";
  els.keyBtn.classList.toggle("pill-accent", !has);
  els.keyNotice.hidden = has;
  els.credits.hidden = !has;
}

function onSaveKey(e) {
  e.preventDefault();
  const key = els.keyInput.value.trim();
  if (!key) return els.keyInput.focus();
  store(KEY_STORE, key);
  els.keyDialog.close();
  syncKeyUi();
  refreshCredits();
  poll();
  toast("API key saved in this browser.");
}

function onRemoveKey() {
  store(KEY_STORE, null);
  els.keyDialog.close();
  syncKeyUi();
  toast("API key removed from this browser.");
}

// ---------- helpers ----------

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}
function button(text, cls, onClick, title) {
  const b = el("button", cls, text);
  b.type = "button";
  if (title) {
    b.title = title;
    b.setAttribute("aria-label", title);
  }
  b.addEventListener("click", onClick);
  return b;
}
function setBusy(btn, busy, text) {
  if (busy) {
    btn.dataset.label = btn.textContent;
    btn.textContent = text;
    btn.disabled = true;
  } else {
    btn.textContent = btn.dataset.label || btn.textContent;
    btn.disabled = false;
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const truncate = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const safeName = (s) => s.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "track";
function fmtTime(sec) {
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
function timeAgo(ts) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(ts).toLocaleDateString();
}
function showError(msg) {
  els.formError.textContent = msg;
  els.formError.hidden = false;
}
function hideError() {
  els.formError.hidden = true;
}
let toastTimer;
function toast(msg, isError) {
  els.toast.textContent = msg;
  els.toast.classList.toggle("toast-error", Boolean(isError));
  els.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (els.toast.hidden = true), 4000);
}
function updateOutputs() {
  els.durationOut.textContent = fmtTime(Number(els.duration.value));
  els.styleWeightOut.textContent = Number(els.styleWeight.value).toFixed(2);
  els.weirdnessOut.textContent = Number(els.weirdness.value).toFixed(2);
  els.extendAtOut.textContent = fmtTime(Number(els.extendAt.value));
}
function updateCounters() {
  document.querySelectorAll(".counter").forEach((c) => {
    const input = document.getElementById(c.dataset.for);
    c.textContent = `${input.value.length} / ${input.maxLength}`;
  });
}

// ---------- theme ----------

function currentTheme() {
  const set = document.documentElement.getAttribute("data-theme");
  if (set) return set;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
function syncThemeButton() {
  const dark = currentTheme() === "dark";
  els.themeToggle.textContent = dark ? "☀️" : "🌙";
  els.themeToggle.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
  els.themeToggle.title = els.themeToggle.getAttribute("aria-label");
}

// ---------- wire up ----------

STYLES.forEach((s) => {
  const chip = button(s, "chip", () => {
    const parts = els.style.value.split(",").map((p) => p.trim()).filter(Boolean);
    const i = parts.findIndex((p) => p.toLowerCase() === s.toLowerCase());
    if (i >= 0) parts.splice(i, 1);
    else parts.push(s);
    els.style.value = parts.join(", ");
    syncChips();
  });
  els.chips.append(chip);
});
function syncChips() {
  const parts = els.style.value.toLowerCase().split(",").map((p) => p.trim());
  els.chips.querySelectorAll(".chip").forEach((c) => {
    const on = parts.includes(c.textContent.toLowerCase());
    c.classList.toggle("active", on);
    c.setAttribute("aria-pressed", String(on));
  });
}

els.tabs.forEach((t) => t.addEventListener("click", () => setMode(t.dataset.mode)));
els.form.addEventListener("submit", onGenerate);
els.instrumental.addEventListener("change", syncInstrumental);
els.style.addEventListener("input", syncChips);
[els.duration, els.styleWeight, els.weirdness, els.extendAt].forEach((r) => r.addEventListener("input", updateOutputs));
[els.prompt, els.lyrics].forEach((t) => t.addEventListener("input", updateCounters));
els.aiToggle.addEventListener("click", () => {
  els.aiBox.hidden = !els.aiBox.hidden;
  if (!els.aiBox.hidden) els.lyricsPrompt.focus();
});
els.lyricsGo.addEventListener("click", onWriteLyrics);
els.lyricsPrompt.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    onWriteLyrics();
  }
});
els.clearAll.addEventListener("click", () => {
  if (confirm("Remove all tracks from this list? (Downloaded files are not affected.)")) {
    tasks = [];
    saveTasks();
    render();
  }
});
els.credits.addEventListener("click", refreshCredits);
els.keyBtn.addEventListener("click", openKeyDialog);
els.keyNoticeBtn.addEventListener("click", openKeyDialog);
els.keyForm.addEventListener("submit", onSaveKey);
els.keyRemove.addEventListener("click", onRemoveKey);
els.keyCancel.addEventListener("click", () => els.keyDialog.close());
els.showKey.addEventListener("change", () => (els.keyInput.type = els.showKey.checked ? "text" : "password"));
els.extendForm.addEventListener("submit", onExtend);
els.extendCancel.addEventListener("click", () => els.extendDialog.close());
els.themeToggle.addEventListener("click", () => {
  const next = currentTheme() === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  store(THEME_STORE, next);
  syncThemeButton();
});
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", syncThemeButton);

// Refresh the "x min ago" labels.
setInterval(() => !polling && tasks.length && render(), 60000);

setMode("simple");
syncThemeButton();
syncChips();
updateOutputs();
updateCounters();

let started = false;
window.startApp = function startApp(userId) {
  if (started) return;
  started = true;
  const legacyKey = KEY_STORE;
  const legacyTasks = TASK_STORE;
  KEY_STORE = `${legacyKey}:${userId}`;
  TASK_STORE = `${legacyTasks}:${userId}`;
  // Data saved before login existed goes to the first account that signs in here.
  for (const [from, to] of [[legacyKey, KEY_STORE], [legacyTasks, TASK_STORE]]) {
    const old = read(from);
    if (old !== null) {
      if (read(to) === null) store(to, old);
      store(from, null);
    }
  }
  tasks = loadTasks();
  syncKeyUi();
  render();
  refreshCredits();
  poll();
};
