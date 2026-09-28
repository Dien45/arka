// Theme sync + iframe error reporting.
//
// SECURITY NOTE: this app can be embedded inside an iframe (e.g. preview /
// sandbox platforms) that pushes the light/dark theme via postMessage. We
// cannot know the parent's exact origin in advance (it's dynamic per
// deployment/sandbox), so we cannot pin `event.origin`. Instead we mitigate
// spoofing from unrelated frames by requiring the message to come from the
// *direct* parent window (`event.source === window.parent`) and by only
// accepting a tightly-validated payload shape (`theme` must be exactly
// "light" or "dark"). This does not fully replace origin pinning, but it
// blocks the common case of unrelated third-party frames/scripts on the same
// page spoofing messages.
(function () {
  var isInIframe = window.self !== window.top;

  function applyThemeToDOM(theme) {
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(theme);
    document.documentElement.setAttribute("data-theme", theme);
  }

  if (isInIframe) {
    window.addEventListener("message", function (event) {
      // Only trust messages coming directly from our parent frame.
      if (event.source !== window.parent) return;
      if (!event.data || typeof event.data !== "object") return;
      var theme = event.data.theme;
      if (theme === "light" || theme === "dark") {
        applyThemeToDOM(theme);
      }
    });
  } else {
    applyThemeToDOM("light");
  }

  // Forward uncaught runtime errors to the parent frame for debugging when
  // embedded. We intentionally keep the payload small and do not include
  // full memory/localStorage contents. Target origin is "*" because the
  // parent origin is dynamic, so treat this purely as best-effort telemetry,
  // never as a trusted/secure channel.
  if (!isInIframe) return;
  var reported = {};
  window.addEventListener("error", function (event) {
    if (!event || !event.message) return;
    var key = event.message + "|" + (event.filename || "") + "|" + (event.lineno || 0);
    if (reported[key]) return;
    reported[key] = true;
    try {
      window.parent.postMessage(
        {
          type: "sandbox-runtime-error",
          payload: {
            message: String(event.message).slice(0, 500),
            filename: event.filename || "",
            lineno: event.lineno || 0,
            colno: event.colno || 0,
            stack:
              event.error && event.error.stack
                ? String(event.error.stack).slice(0, 2000)
                : "",
          },
        },
        "*"
      );
    } catch (e) {
      /* reporting failure must never break the app */
    }
  });
})();
