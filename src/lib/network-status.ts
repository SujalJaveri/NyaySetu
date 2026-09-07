import { useEffect, useState, useCallback, useSyncExternalStore } from "react";

// In-memory singleton state for network connectivity
let isOnlineState = typeof navigator !== "undefined" ? navigator.onLine : true;
let lastOnlineTime: number = Date.now();
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

/**
 * Ping lightweight endpoint to verify actual reachability (avoiding false positives
 * on captive portals or local court Wi-Fi without internet access).
 */
export async function checkActualConnectivity(): Promise<boolean> {
  if (typeof window === "undefined") return true;
  if (!navigator.onLine) {
    updateOnlineStatus(false);
    return false;
  }

  try {
    // Attempt a HEAD/GET request to a reliable public endpoint with a cache-buster
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    // Using Supabase ping or an ultra-lightweight endpoint
    const res = await fetch("https://keqlhaerxaliqljyibzx.supabase.co/rest/v1/", {
      method: "HEAD",
      signal: controller.signal,
      headers: { apikey: "sb_publishable_FZvKCCOsCUtbS9qP7v2XAw_xblsYT8d" },
      cache: "no-store",
    });
    clearTimeout(timeoutId);

    const online = res.status < 500;
    updateOnlineStatus(online);
    return online;
  } catch {
    // If request timed out or threw network error, we are effectively offline
    updateOnlineStatus(false);
    return false;
  }
}

function updateOnlineStatus(online: boolean) {
  if (isOnlineState !== online) {
    isOnlineState = online;
    if (online) {
      lastOnlineTime = Date.now();
    }
    notifyListeners();
  }
}

// Attach browser window events
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    // Double check with actual ping before declaring online
    checkActualConnectivity();
  });

  window.addEventListener("offline", () => {
    updateOnlineStatus(false);
  });

  // Periodic background heartbeat ping every 30 seconds
  setInterval(() => {
    checkActualConnectivity();
  }, 30000);
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function getSnapshot() {
  return isOnlineState;
}

function getServerSnapshot() {
  return true;
}

/**
 * Hook to reactively consume internet connectivity status anywhere in the app.
 */
export function useNetworkStatus() {
  const isOnline = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [isChecking, setIsChecking] = useState(false);

  const checkConnection = useCallback(async () => {
    setIsChecking(true);
    try {
      return await checkActualConnectivity();
    } finally {
      setIsChecking(false);
    }
  }, []);

  return {
    isOnline,
    isChecking,
    lastOnlineTime,
    checkConnection,
  };
}
