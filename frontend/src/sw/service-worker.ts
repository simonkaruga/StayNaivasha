import { precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { StaleWhileRevalidate, CacheFirst, NetworkFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { BackgroundSyncPlugin } from "workbox-background-sync";

/// <reference lib="webworker" />
export {};
declare const self: ServiceWorkerGlobalScope & typeof globalThis;

// Precache app shell
precacheAndRoute(self.__WB_MANIFEST);

// Property listings — StaleWhileRevalidate (browse offline after first load)
registerRoute(
  ({ url }) => url.pathname.startsWith("/api/properties"),
  new NetworkFirst({
    cacheName: "properties-cache",
    plugins: [new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 300 })],
  })
);

// Cloudinary photos — CacheFirst, 7-day expiry (photos available offline once viewed)
registerRoute(
  ({ url }) => url.hostname === "res.cloudinary.com",
  new CacheFirst({
    cacheName: "property-images",
    plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 604800 })],
  })
);

// App shell HTML/CSS/JS — CacheFirst versioned (instant load on repeat visit)
registerRoute(
  ({ request }) => request.destination === "document",
  new StaleWhileRevalidate({ cacheName: "app-shell" })
);

// Booking confirmations — permanent cache (guest must see check-in code at gate)
registerRoute(
  ({ url }) => url.pathname.startsWith("/booking-confirm"),
  new CacheFirst({ cacheName: "booking-confirmations" })
);

// Background sync — retry failed bookings when connection returns
const bookingSync = new BackgroundSyncPlugin("booking-queue", {
  maxRetentionTime: 60, // retry for up to 1 hour
});

registerRoute(
  ({ url }) => url.pathname === "/api/bookings",
  new NetworkFirst({
    cacheName: "booking-attempts",
    plugins: [bookingSync],
  }),
  "POST"
);

// Push notification handler
self.addEventListener("push", (event: PushEvent) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title ?? "StayNaivasha", {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url ?? "/" },
    })
  );
});

// Notification click — open the relevant page
self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then(clients => {
      const existing = clients.find(c => c.url.includes(self.location.origin));
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    })
  );
});

// Offline fallback — never show raw browser error
self.addEventListener("fetch", (event: FetchEvent) => {
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match("/") as Promise<Response>
      )
    );
  }
});
