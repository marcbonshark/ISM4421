// Applies the saved light/dark theme before the page paints, so there's no flash.
// Loaded in <head> as an external file because the site's CSP blocks inline scripts.
(function () {
  try {
    var saved = localStorage.getItem("owl-weather-theme");
    if (saved === "light" || saved === "dark") {
      document.documentElement.setAttribute("data-theme", saved);
    }
  } catch (e) { /* storage unavailable: follow the system theme */ }
})();
