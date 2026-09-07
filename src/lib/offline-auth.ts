/**
 * NyayaSetu Offline Authentication & Secure Staff Vault
 * Allows judges and registrars to log in and access the court registry even without internet.
 * Uses SHA-256 salted cryptographic hashing so plaintext passwords are never stored.
 */

export interface OfflineStaffAccount {
  id: string;
  email: string;
  fullName: string;
  role: "admin" | "registrar" | "judge";
  judgeId: string | null;
  judgeName: string | null;
  passwordHash: string;
  salt: string;
  lastSyncedAt: string;
}

const VAULT_STORAGE_KEY = "nyayasetu_staff_vault_v1";
const SESSION_STORAGE_KEY = "nyayasetu_offline_session_v1";
const GLOBAL_COURT_SALT = "nyayasetu_district_court_salt_2026";

/**
 * Computes a salted SHA-256 hash using the Web Crypto API
 */
export async function computePasswordHash(password: string, userSalt: string = GLOBAL_COURT_SALT): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${userSalt}:${GLOBAL_COURT_SALT}:${password.trim()}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Retrieves the list of known court staff in the local offline vault
 */
export function getOfflineStaffVault(): OfflineStaffAccount[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(VAULT_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as OfflineStaffAccount[];
  } catch (err) {
    console.error("Failed to read offline staff vault", err);
    return [];
  }
}

/**
 * Registers or updates a staff member in the local offline vault
 */
export async function cacheStaffCredentialsLocally(
  staff: {
    id: string;
    email: string;
    fullName: string;
    role: "admin" | "registrar" | "judge";
    judgeId?: string | null;
    judgeName?: string | null;
  },
  plainPassword?: string,
): Promise<void> {
  if (typeof window === "undefined") return;

  const vault = getOfflineStaffVault();
  const existing = vault.find((s) => s.email.toLowerCase() === staff.email.toLowerCase());
  const userSalt = existing?.salt || Math.random().toString(36).substring(2, 10);

  let passwordHash = existing?.passwordHash || "";
  if (plainPassword) {
    passwordHash = await computePasswordHash(plainPassword, userSalt);
  }

  const updatedAccount: OfflineStaffAccount = {
    id: staff.id,
    email: staff.email.toLowerCase(),
    fullName: staff.fullName,
    role: staff.role,
    judgeId: staff.judgeId ?? existing?.judgeId ?? null,
    judgeName: staff.judgeName ?? existing?.judgeName ?? null,
    passwordHash,
    salt: userSalt,
    lastSyncedAt: new Date().toISOString(),
  };

  const filtered = vault.filter((s) => s.email.toLowerCase() !== staff.email.toLowerCase());
  const newVault = [...filtered, updatedAccount];

  try {
    localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(newVault));
  } catch (err) {
    console.error("Failed to save to offline staff vault", err);
  }
}

/**
 * Validates credentials against the local offline vault when disconnected
 */
export async function authenticateOffline(
  email: string,
  plainPassword: string,
): Promise<{ success: boolean; account?: OfflineStaffAccount; error?: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  const vault = getOfflineStaffVault();
  const account = vault.find((s) => s.email === normalizedEmail);

  if (!account) {
    return {
      success: false,
      error: "No offline record found for this email on this device. Sign in once while online to cache your credentials.",
    };
  }

  if (!account.passwordHash) {
    return {
      success: false,
      error: "Account exists in directory, but has not logged into this laptop yet.",
    };
  }

  const inputHash = await computePasswordHash(plainPassword, account.salt);
  if (inputHash !== account.passwordHash) {
    return {
      success: false,
      error: "Invalid offline password. Please verify your credentials.",
    };
  }

  // Set active offline session
  setOfflineStaffSession(account);
  return { success: true, account };
}

/**
 * Gets the current offline session (if logged in while disconnected)
 */
export function getOfflineStaffSession(): OfflineStaffAccount | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OfflineStaffAccount;
  } catch {
    return null;
  }
}

/**
 * Sets or clears the active offline session
 */
export function setOfflineStaffSession(account: OfflineStaffAccount | null): void {
  if (typeof window === "undefined") return;
  try {
    if (account) {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(account));
    } else {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch (err) {
    console.error("Failed to update offline staff session", err);
  }
}

/**
 * Logs out of offline session
 */
export function clearOfflineStaffSession(): void {
  setOfflineStaffSession(null);
}
