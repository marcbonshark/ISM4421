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

// If a logo fails to load (e.g. Wikimedia is unreachable), swap in the local
// owl emblem named by data-fallback. Listening on window in the capture phase
// catches image errors even if they fire before the rest of the page loads.
window.addEventListener("error", function (e) {
  var img = e.target;
  if (img && img.tagName === "IMG" && img.dataset.fallback && !img.dataset.fellBack) {
    img.dataset.fellBack = "1";
    img.src = img.dataset.fallback;
  }
}, true);
