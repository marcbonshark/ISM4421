// Owl Weather — FAU-themed weather app powered by Open-Meteo (no API key needed).

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";

// Default location: Florida Atlantic University, Boca Raton campus.
const FAU_BOCA = {
  name: "FAU Boca Raton",
  region: "Florida, United States",
  latitude: 26.3728,
  longitude: -80.1024,
};

const STORAGE_KEY = "owl-weather-unit";
const THEME_KEY = "owl-weather-theme";
const USER_NAME = "Mark Bonner";

// WMO weather interpretation codes → description + day/night icons.
const WEATHER_CODES = {
  0: ["Clear sky", "☀️", "🌙"],
  1: ["Mainly clear", "🌤️", "🌙"],
  2: ["Partly cloudy", "⛅", "☁️"],
  3: ["Overcast", "☁️", "☁️"],
  45: ["Fog", "🌫️", "🌫️"],
  48: ["Depositing rime fog", "🌫️", "🌫️"],
  51: ["Light drizzle", "🌦️", "🌧️"],
  53: ["Drizzle", "🌦️", "🌧️"],
  55: ["Dense drizzle", "🌧️", "🌧️"],
  56: ["Light freezing drizzle", "🌧️", "🌧️"],
  57: ["Freezing drizzle", "🌧️", "🌧️"],
  61: ["Light rain", "🌦️", "🌧️"],
  63: ["Rain", "🌧️", "🌧️"],
  65: ["Heavy rain", "🌧️", "🌧️"],
  66: ["Light freezing rain", "🌧️", "🌧️"],
  67: ["Freezing rain", "🌧️", "🌧️"],
  71: ["Light snow", "🌨️", "🌨️"],
  73: ["Snow", "🌨️", "🌨️"],
  75: ["Heavy snow", "❄️", "❄️"],
  77: ["Snow grains", "🌨️", "🌨️"],
  80: ["Light showers", "🌦️", "🌧️"],
  81: ["Showers", "🌧️", "🌧️"],
  82: ["Violent showers", "⛈️", "⛈️"],
  85: ["Light snow showers", "🌨️", "🌨️"],
  86: ["Snow showers", "❄️", "❄️"],
  95: ["Thunderstorm", "⛈️", "⛈️"],
  96: ["Thunderstorm with hail", "⛈️", "⛈️"],
  99: ["Severe thunderstorm with hail", "⛈️", "⛈️"],
};

const state = {
  unit: loadUnit(),
  place: FAU_BOCA,
  data: null,
  searchResults: [],
  activeResult: -1,
};

const $ = (id) => document.getElementById(id);
const els = {
  status: $("status"),
  current: $("current"),
  hourlySection: $("hourly-section"),
  dailySection: $("daily-section"),
  placeName: $("place-name"),
  placeTime: $("place-time"),
  currentIcon: $("current-icon"),
  currentTemp: $("current-temp"),
  currentDesc: $("current-desc"),
  currentFeels: $("current-feels"),
  currentHilo: $("current-hilo"),
  currentDetails: $("current-details"),
  hourly: $("hourly"),
  daily: $("daily"),
  form: $("search-form"),
  input: $("search-input"),
  results: $("search-results"),
  locateBtn: $("locate-btn"),
  homeBtn: $("home-btn"),
  themeToggle: $("theme-toggle"),
  welcomeTitle: $("welcome-title"),
  welcomeText: $("welcome-text"),
};

// ---------- Helpers ----------

function loadUnit() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "celsius" ? "celsius" : "fahrenheit";
  } catch {
    return "fahrenheit";
  }
}

function saveUnit(unit) {
  try { localStorage.setItem(STORAGE_KEY, unit); } catch { /* storage unavailable */ }
}

function describe(code, isDay = 1) {
  const entry = WEATHER_CODES[code] || ["Unknown", "🌡️", "🌡️"];
  return { text: entry[0], icon: isDay ? entry[1] : entry[2] };
}

// Open-Meteo returns local times ("2026-09-28T14:00") when timezone=auto.
// Parse the parts directly so the browser's own time zone never shifts them.
function parseLocal(iso) {
  const [date, time = "00:00"] = iso.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return { y, m, d, hh, mm, date: new Date(Date.UTC(y, m - 1, d, hh, mm)) };
}

function fmtHour(iso) {
  const { hh } = parseLocal(iso);
  const h12 = hh % 12 || 12;
  return `${h12} ${hh < 12 ? "AM" : "PM"}`;
}

function fmtClock(iso) {
  const { hh, mm } = parseLocal(iso);
  const h12 = hh % 12 || 12;
  return `${h12}:${String(mm).padStart(2, "0")} ${hh < 12 ? "AM" : "PM"}`;
}

function fmtWeekday(iso, style = "long") {
  return parseLocal(iso).date.toLocaleDateString("en-US", { weekday: style, timeZone: "UTC" });
}

function fmtFullDate(iso) {
  return parseLocal(iso).date.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", timeZone: "UTC",
  });
}

function compass(deg) {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

function uvLabel(uv) {
  if (uv < 3) return "Low";
  if (uv < 6) return "Moderate";
  if (uv < 8) return "High";
  if (uv < 11) return "Very high";
  return "Extreme";
}

const round = (n) => Math.round(n);
// Open-Meteo reports miles per hour as "mp/h".
const speedUnit = (u) => (u === "mp/h" ? "mph" : u);
const deg = () => (state.unit === "celsius" ? "°C" : "°F");

function setStatus(message, isError = false) {
  els.status.textContent = message;
  els.status.classList.toggle("error", isError);
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// ---------- Welcome ----------

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Up late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// A short, weather-aware tip for the welcome banner.
function weatherTip(current, daily) {
  const code = current.weather_code;
  const hot = state.unit === "celsius" ? 35 : 95;
  const cold = state.unit === "celsius" ? 10 : 50;
  if (code >= 95) return "Storms are in the area, so stay safe indoors.";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || daily.precipitation_probability_max[0] >= 50) {
    return "Grab an umbrella before heading to class.";
  }
  if (current.apparent_temperature >= hot) return "It's a hot one. Stay hydrated!";
  if (daily.uv_index_max[0] >= 8) return "The UV index is very high, so don't forget sunscreen.";
  if (current.apparent_temperature <= cold) return "Bundle up, it's chilly for Florida!";
  return "Great day to be an Owl!";
}

function renderWelcome() {
  els.welcomeTitle.textContent = `${greeting()}, ${USER_NAME}!`;
  const data = state.data;
  if (!data) return;
  const w = describe(data.current.weather_code, data.current.is_day);
  els.welcomeText.textContent =
    `It's ${round(data.current.temperature_2m)}${deg()} and ${w.text.toLowerCase()} in ${state.place.name}. ` +
    weatherTip(data.current, data.daily);
}

// ---------- Theme ----------

const systemDark = window.matchMedia("(prefers-color-scheme: dark)");

function currentTheme() {
  return document.documentElement.getAttribute("data-theme") || (systemDark.matches ? "dark" : "light");
}

function updateThemeButton() {
  const next = currentTheme() === "dark" ? "light" : "dark";
  els.themeToggle.textContent = next === "dark" ? "🌙" : "☀️";
  els.themeToggle.setAttribute("aria-label", `Switch to ${next} theme`);
  els.themeToggle.title = `Switch to ${next} theme`;
}

els.themeToggle.addEventListener("click", () => {
  const next = currentTheme() === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  try { localStorage.setItem(THEME_KEY, next); } catch { /* storage unavailable */ }
  updateThemeButton();
});

systemDark.addEventListener("change", updateThemeButton);
updateThemeButton();

// ---------- API ----------

async function fetchForecast(place, unit) {
  const params = new URLSearchParams({
    latitude: place.latitude,
    longitude: place.longitude,
    current: [
      "temperature_2m", "relative_humidity_2m", "apparent_temperature", "is_day",
      "precipitation", "weather_code", "cloud_cover", "pressure_msl",
      "wind_speed_10m", "wind_direction_10m", "wind_gusts_10m",
    ].join(","),
    hourly: ["temperature_2m", "precipitation_probability", "weather_code", "is_day"].join(","),
    daily: [
      "weather_code", "temperature_2m_max", "temperature_2m_min",
      "precipitation_probability_max", "sunrise", "sunset", "uv_index_max",
    ].join(","),
    temperature_unit: unit,
    wind_speed_unit: unit === "celsius" ? "kmh" : "mph",
    precipitation_unit: unit === "celsius" ? "mm" : "inch",
    timezone: "auto",
    forecast_days: 7,
  });
  const res = await fetch(`${FORECAST_URL}?${params}`);
  if (!res.ok) throw new Error(`Forecast request failed (${res.status})`);
  return res.json();
}

async function searchPlaces(query) {
  const params = new URLSearchParams({ name: query, count: 6, language: "en", format: "json" });
  const res = await fetch(`${GEOCODE_URL}?${params}`);
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  const json = await res.json();
  return (json.results || []).map((r) => ({
    name: r.name,
    region: [r.admin1, r.country].filter(Boolean).join(", "),
    latitude: r.latitude,
    longitude: r.longitude,
  }));
}

// ---------- Rendering ----------

function render() {
  const data = state.data;
  if (!data) return;
  const { current, current_units: cu, hourly, daily } = data;
  const now = describe(current.weather_code, current.is_day);

  els.placeName.textContent = state.place.region
    ? `${state.place.name}, ${state.place.region.split(",")[0]}`
    : state.place.name;
  els.placeTime.textContent = `${fmtFullDate(current.time)} · Updated ${fmtClock(current.time)} local time`;
  els.currentIcon.textContent = now.icon;
  els.currentTemp.textContent = `${round(current.temperature_2m)}${deg()}`;
  els.currentDesc.textContent = now.text;
  els.currentFeels.textContent = `Feels like ${round(current.apparent_temperature)}${deg()}`;
  els.currentHilo.textContent =
    `High ${round(daily.temperature_2m_max[0])}${deg()} · Low ${round(daily.temperature_2m_min[0])}${deg()}`;

  const details = [
    ["Humidity", `${round(current.relative_humidity_2m)}%`],
    ["Wind", `${round(current.wind_speed_10m)} ${speedUnit(cu.wind_speed_10m)} ${compass(current.wind_direction_10m)}`],
    ["Gusts", `${round(current.wind_gusts_10m)} ${speedUnit(cu.wind_gusts_10m)}`],
    ["Precipitation", `${current.precipitation} ${cu.precipitation}`],
    ["Cloud cover", `${round(current.cloud_cover)}%`],
    ["Pressure", `${round(current.pressure_msl)} hPa`],
    ["UV index", `${round(daily.uv_index_max[0])} · ${uvLabel(daily.uv_index_max[0])}`],
    ["Sunrise", fmtClock(daily.sunrise[0])],
    ["Sunset", fmtClock(daily.sunset[0])],
  ];
  els.currentDetails.innerHTML = details
    .map(([k, v]) => `<div><dt>${k}</dt><dd>${escapeHtml(v)}</dd></div>`)
    .join("");

  // Hourly: start at the current local hour, show the next 24.
  const currentHour = current.time.slice(0, 13) + ":00";
  let start = hourly.time.findIndex((t) => t >= currentHour);
  if (start < 0) start = 0;
  els.hourly.innerHTML = hourly.time.slice(start, start + 24).map((t, i) => {
    const idx = start + i;
    const w = describe(hourly.weather_code[idx], hourly.is_day[idx]);
    const pop = hourly.precipitation_probability[idx];
    return `
      <div class="hour${i === 0 ? " now" : ""}">
        <div class="hour-time">${i === 0 ? "Now" : fmtHour(t)}</div>
        <div class="hour-icon" title="${w.text}">${w.icon}</div>
        <div class="hour-temp">${round(hourly.temperature_2m[idx])}°</div>
        <div class="hour-pop">${pop ? `💧${pop}%` : ""}</div>
      </div>`;
  }).join("");

  els.daily.innerHTML = daily.time.map((t, i) => {
    const w = describe(daily.weather_code[i]);
    const pop = daily.precipitation_probability_max[i];
    return `
      <div class="day">
        <div class="day-name">${i === 0 ? "Today" : fmtWeekday(t, "short")}</div>
        <div class="day-icon" aria-hidden="true">${w.icon}</div>
        <div class="day-desc">${w.text}${pop ? ` · <span class="pop">💧${pop}%</span>` : ""}</div>
        <div class="day-temps">${round(daily.temperature_2m_max[i])}°<span class="lo">${round(daily.temperature_2m_min[i])}°</span></div>
      </div>`;
  }).join("");

  els.current.hidden = false;
  els.hourlySection.hidden = false;
  els.dailySection.hidden = false;
  document.title = `${round(current.temperature_2m)}${deg()} ${state.place.name} | Owl Weather`;
  renderWelcome();
}

async function loadWeather(place = state.place) {
  state.place = place;
  setStatus(`Loading weather for ${place.name}…`);
  try {
    state.data = await fetchForecast(place, state.unit);
    render();
    setStatus("");
  } catch (err) {
    console.error(err);
    setStatus("Couldn't load the weather right now. Please try again in a moment.", true);
  }
}

// ---------- Search ----------

function showResults(results) {
  state.searchResults = results;
  state.activeResult = -1;
  if (!results.length) {
    els.results.innerHTML = `<li class="muted">No matching places found.</li>`;
  } else {
    els.results.innerHTML = results.map((r, i) => `
      <li role="option" data-index="${i}" aria-selected="false">
        <strong>${escapeHtml(r.name)}</strong>
        <div class="muted">${escapeHtml(r.region)}</div>
      </li>`).join("");
  }
  els.results.hidden = false;
}

function hideResults() {
  els.results.hidden = true;
  state.activeResult = -1;
}

function selectResult(index) {
  const place = state.searchResults[index];
  if (!place) return;
  hideResults();
  els.input.value = "";
  loadWeather(place);
}

function highlight(index) {
  const items = els.results.querySelectorAll("li[role=option]");
  items.forEach((li, i) => li.setAttribute("aria-selected", String(i === index)));
  state.activeResult = index;
}

let searchTimer;
els.input.addEventListener("input", () => {
  clearTimeout(searchTimer);
  const q = els.input.value.trim();
  if (q.length < 2) return hideResults();
  searchTimer = setTimeout(async () => {
    try {
      showResults(await searchPlaces(q));
    } catch (err) {
      console.error(err);
    }
  }, 300);
});

els.input.addEventListener("keydown", (e) => {
  const count = state.searchResults.length;
  if (els.results.hidden || !count) return;
  if (e.key === "ArrowDown") {
    e.preventDefault();
    highlight((state.activeResult + 1) % count);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    highlight((state.activeResult - 1 + count) % count);
  } else if (e.key === "Escape") {
    hideResults();
  }
});

els.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (state.activeResult >= 0) return selectResult(state.activeResult);
  const q = els.input.value.trim();
  if (!q) return;
  try {
    const results = await searchPlaces(q);
    if (results.length) {
      state.searchResults = results;
      selectResult(0);
    } else {
      showResults([]);
    }
  } catch (err) {
    console.error(err);
    setStatus("Search is unavailable right now.", true);
  }
});

els.results.addEventListener("click", (e) => {
  const li = e.target.closest("li[data-index]");
  if (li) selectResult(Number(li.dataset.index));
});

document.addEventListener("click", (e) => {
  if (!els.form.contains(e.target)) hideResults();
});

// ---------- Buttons ----------

els.homeBtn.addEventListener("click", () => loadWeather(FAU_BOCA));

els.locateBtn.addEventListener("click", () => {
  if (!navigator.geolocation) {
    setStatus("Your browser doesn't support location lookup.", true);
    return;
  }
  setStatus("Finding your location…");
  navigator.geolocation.getCurrentPosition(
    (pos) => loadWeather({
      name: "My location",
      region: "",
      latitude: Number(pos.coords.latitude.toFixed(4)),
      longitude: Number(pos.coords.longitude.toFixed(4)),
    }),
    () => setStatus("Couldn't get your location. Check your browser's location permission.", true),
    { timeout: 10000 },
  );
});

document.querySelectorAll(".unit-toggle button").forEach((btn) => {
  btn.classList.toggle("active", btn.dataset.unit === state.unit);
  btn.addEventListener("click", () => {
    if (btn.dataset.unit === state.unit) return;
    state.unit = btn.dataset.unit;
    saveUnit(state.unit);
    document.querySelectorAll(".unit-toggle button")
      .forEach((b) => b.classList.toggle("active", b === btn));
    loadWeather();
  });
});

// ---------- Start ----------

renderWelcome();
loadWeather(FAU_BOCA);
// Refresh every 15 minutes while the tab is open.
setInterval(() => loadWeather(), 15 * 60 * 1000);
