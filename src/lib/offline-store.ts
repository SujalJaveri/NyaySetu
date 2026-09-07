import { useSyncExternalStore } from "react";

export type OfflineDraftType =
  | "reschedule"
  | "hearing_note"
  | "judge_assignment"
  | "case_status"
  | "custom";

export interface OfflineDraft {
  id: string;
  type: OfflineDraftType;
  title: string;
  description: string;
  payload: Record<string, unknown>;
  createdAt: string;
  status: "pending" | "syncing" | "failed" | "synced";
  error?: string;
}

const STORAGE_KEY = "nyayasetu_offline_drafts_v1";
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

export function getOfflineDrafts(): OfflineDraft[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as OfflineDraft[];
  } catch (err) {
    console.error("Failed to read offline drafts from storage", err);
    return [];
  }
}

export function saveOfflineDraft(
  draftData: Omit<OfflineDraft, "id" | "createdAt" | "status">,
): OfflineDraft {
  const drafts = getOfflineDrafts();
  const newDraft: OfflineDraft = {
    ...draftData,
    id: `draft_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    createdAt: new Date().toISOString(),
    status: "pending",
  };

  const updated = [newDraft, ...drafts];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error("Failed to persist offline draft", err);
  }

  notifyListeners();
  return newDraft;
}

export function removeOfflineDraft(id: string): void {
  const drafts = getOfflineDrafts();
  const updated = drafts.filter((d) => d.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error("Failed to remove offline draft", err);
  }
  notifyListeners();
}

export function updateOfflineDraftStatus(
  id: string,
  status: OfflineDraft["status"],
  error?: string,
): void {
  const drafts = getOfflineDrafts();
  const updated = drafts.map((d) => (d.id === id ? { ...d, status, error } : d));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error("Failed to update offline draft status", err);
  }
  notifyListeners();
}

export function clearAllDrafts(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error("Failed to clear offline drafts", err);
  }
  notifyListeners();
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

let cachedDraftsSnapshot: OfflineDraft[] = [];
let cachedDraftsRaw = "";

function getSnapshot(): OfflineDraft[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEY) || "[]";
  if (raw !== cachedDraftsRaw) {
    cachedDraftsRaw = raw;
    try {
      cachedDraftsSnapshot = JSON.parse(raw);
    } catch {
      cachedDraftsSnapshot = [];
    }
  }
  return cachedDraftsSnapshot;
}

function getServerSnapshot(): OfflineDraft[] {
  return [];
}

/**
 * Reactive hook to observe and manage offline drafts in UI components.
 */
export function useOfflineDrafts() {
  const drafts = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return {
    drafts,
    pendingCount: drafts.filter((d) => d.status === "pending").length,
    saveDraft: saveOfflineDraft,
    removeDraft: removeOfflineDraft,
    updateStatus: updateOfflineDraftStatus,
    clearAll: clearAllDrafts,
  };
}
