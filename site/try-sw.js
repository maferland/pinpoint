// Intercepts the annotator's API calls (including native <img> loads) for the static demo page — no backend exists here.

const DEMO_ID = "try-demo";
const IMAGE_PATH = "/assets/demo-content.png";

let annotations = [];
let prefs = {
  autoCloseAfterDone: false,
  viewMode: "fit",
  compareView: "split",
  idleReminder: false,
  idleReminderDelaySec: 60,
};

function review() {
  return {
    version: "1.0",
    id: DEMO_ID,
    images: [{ path: IMAGE_PATH, width: 1440, height: 900 }],
    context: JSON.stringify({
      message: "Try it — click to drop a pin, drag to draw a region, then hit Send. Nothing leaves your browser.",
    }),
    createdAt: new Date(0).toISOString(),
    annotations,
  };
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const path = url.pathname;
  const method = event.request.method;

  if (url.hostname === "api.github.com" && path.endsWith("/releases/latest")) {
    event.respondWith(new Response(null, { status: 404 }));
    return;
  }

  if (path === `/api/review/${DEMO_ID}` && method === "GET") {
    event.respondWith(json(review()));
    return;
  }

  if (path === `/api/review/${DEMO_ID}/image` && method === "GET") {
    event.respondWith(fetch(IMAGE_PATH));
    return;
  }

  if (path === `/api/review/${DEMO_ID}/annotations` && method === "PUT") {
    event.respondWith(
      event.request.text().then((body) => {
        annotations = JSON.parse(body || "[]");
        return json({ ok: true });
      })
    );
    return;
  }

  if (path === `/api/review/${DEMO_ID}/finalize` && method === "POST") {
    event.respondWith(json({ ok: true }));
    return;
  }

  if (path === "/api/preferences" && method === "GET") {
    event.respondWith(json(prefs));
    return;
  }

  if (path === "/api/preferences" && method === "PUT") {
    event.respondWith(
      event.request.text().then((body) => {
        prefs = { ...prefs, ...JSON.parse(body || "{}") };
        return json(prefs);
      })
    );
    return;
  }
});
