import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5, retry: 1 },
  },
});

// ── Service worker + push notifications ───────────────────────────────────────

async function registerSW() {
  if (!("serviceWorker" in navigator)) return;

  try {
    const reg = await navigator.serviceWorker.register("/service-worker.js", { scope: "/" });

    // Ask for push permission only after user gesture — prompt on first booking
    window.__requestPush = async () => {
      if (!("PushManager" in window)) return;
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return;

      // VAPID public key — replace with your actual key from the backend config
    const VAPID_PUBLIC_KEY = (import.meta as any).env?.VITE_VAPID_PUBLIC_KEY ?? "";
    if (!VAPID_PUBLIC_KEY) return;

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as ArrayBuffer,
    });

      // Send subscription to backend to store against the user's FCM token slot
      await fetch("/api/auth/push-subscribe", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      }).catch(() => {}); // non-critical
    };
  } catch (e) {
    console.warn("[SW] Registration failed:", e);
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

// Register after first paint to not block LCP
if (document.readyState === "complete") {
  registerSW();
} else {
  window.addEventListener("load", registerSW);
}

// Extend Window type
declare global {
  interface Window {
    __requestPush?: () => Promise<void>;
  }
}

// ── App bootstrap ─────────────────────────────────────────────────────────────

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
