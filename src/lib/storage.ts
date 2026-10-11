import { validate, type Workspace } from "./business";
export type Envelope = {
  version: 1;
  revision: number;
  salt: string;
  iv: string;
  ciphertext: string;
};
const enc = new TextEncoder();
const dec = new TextDecoder();
const b64 = (a: Uint8Array) =>
  btoa(Array.from(a, (x) => String.fromCharCode(x)).join(""));
const bytes = (s: string) => Uint8Array.from(atob(s), (x) => x.charCodeAt(0));
export async function derive(password: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: 250000,
      hash: "SHA-256",
    },
    key,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
export async function seal(
  state: Workspace,
  key: CryptoKey,
  salt: string,
): Promise<Envelope> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: enc.encode("wrapnwhip-v1") },
    key,
    enc.encode(JSON.stringify(state)),
  );
  return {
    version: 1,
    revision: state.revision,
    salt,
    iv: b64(iv),
    ciphertext: b64(new Uint8Array(ciphertext)),
  };
}
export async function create(password: string, state: Workspace) {
  if (password.length < 8)
    throw Error("Use at least 8 characters for your workspace password.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await derive(password, salt);
  return { key, envelope: await seal(state, key, b64(salt)) };
}
export async function unlock(password: string, envelope: Envelope) {
  if (
    envelope?.version !== 1 ||
    typeof envelope.salt !== "string" ||
    typeof envelope.iv !== "string" ||
    typeof envelope.ciphertext !== "string"
  )
    throw Error("Invalid encrypted backup.");
  try {
    const key = await derive(password, bytes(envelope.salt));
    return { key, state: await unlockWithKey(key, envelope) };
  } catch {
    throw Error("Incorrect password or damaged backup.");
  }
}
export async function unlockWithKey(key: CryptoKey, envelope: Envelope) {
  const data = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: bytes(envelope.iv) as BufferSource,
      additionalData: enc.encode("wrapnwhip-v1"),
    },
    key,
    bytes(envelope.ciphertext) as BufferSource,
  );
  const state = validate(JSON.parse(dec.decode(data)));
  if (state.revision !== envelope.revision) throw Error("Invalid revision.");
  return state;
}
async function api(path: string, init?: RequestInit) {
  const response = await fetch(path, { ...init, cache: "no-store" });
  const data = await response.json();
  if (!response.ok)
    throw Error(
      data.error || "Shared storage is unavailable. Nothing was changed.",
    );
  return data;
}
export async function authenticate(password: string) {
  await api("/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
}
export async function signOut() {
  await fetch("/api/session", {
    method: "DELETE",
    signal: AbortSignal.timeout(10000),
  });
}
export async function read(): Promise<Envelope | null> {
  const response = await fetch("/api/workspace", { cache: "no-store" });
  if (response.status === 401) return null;
  const data = await response.json();
  if (!response.ok)
    throw Error(data.error || "Could not load the shared workspace.");
  return data.envelope;
}
export async function write(envelope: Envelope, expected: number | null) {
  await api("/api/workspace", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ envelope, expected }),
  });
}
// Read the earlier local workspace only when its owner explicitly exports it.
export async function readLegacy(): Promise<Envelope> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("wrapnwhip-private", 1);
    request.onupgradeneeded = () => request.transaction?.abort();
    request.onerror = () =>
      reject(
        Error(
          "No old browser workspace was found on this device and website URL.",
        ),
      );
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("workspace")) {
        db.close();
        reject(Error("No old browser workspace was found."));
        return;
      }
      const read = db
        .transaction("workspace", "readonly")
        .objectStore("workspace")
        .get("main");
      read.onsuccess = () => {
        db.close();
        if (read.result?.version === 1) resolve(read.result);
        else reject(Error("No old browser workspace was found."));
      };
      read.onerror = () => {
        db.close();
        reject(Error("Could not read the old browser backup."));
      };
    };
  });
}
export function download(
  name: string,
  value: Blob | string,
  type = "application/json",
) {
  const blob = typeof value === "string" ? new Blob([value], { type }) : value;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function csv(rows: Record<string, unknown>[]) {
  const columns = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const cell = (v: unknown) => {
    let s =
      v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    if (/^[\s]*[=+@-]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return [
    columns.map(cell).join(","),
    ...rows.map((r) => columns.map((c) => cell(r[c])).join(",")),
  ].join("\r\n");
}
