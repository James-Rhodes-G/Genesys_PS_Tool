const CACHE_NAME = "log-pages-v1";
const STATIC_ASSETS = ["/styles.css", "/favicon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
  );
});

const shouldBypassCache = (request) => {
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/launch")) {
    return true;
  }
  return request.mode === "navigate";
};

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (shouldBypassCache(request)) {
    event.respondWith(fetch(request));
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});

self.addEventListener("message", (event) => {
  if (!event.data || event.data.type !== "LIST_CLIENTS") {
    return;
  }

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        const tabs = clientList.map((client) => ({
          id: client.id,
          url: client.url,
          focused: "focused" in client ? client.focused : false,
        }));
        event.source?.postMessage?.({ type: "LIST_CLIENTS_RESULT", tabs });
      })
  );
});
