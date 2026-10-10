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
    return { key, state };
  } catch {
    throw Error("Incorrect password or damaged backup.");
  }
}
async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open("wrapnwhip-private", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("workspace");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () =>
      reject(
        Error("Browser storage is unavailable. Use a regular browser window."),
      );
  });
}
export async function read(): Promise<Envelope | null> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const t = db.transaction("workspace", "readonly");
      const r = t.objectStore("workspace").get("main");
      r.onsuccess = () => resolve(r.result ?? null);
      r.onerror = () => reject(Error("Could not read saved records."));
    });
  } finally {
    db.close();
  }
}
export async function write(envelope: Envelope, expected: number | null) {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const t = db.transaction("workspace", "readwrite");
      const store = t.objectStore("workspace");
      let conflict = false;
      const r = store.get("main");
      r.onsuccess = () => {
        const old = r.result as Envelope | undefined;
        if ((old?.revision ?? null) !== expected) {
          conflict = true;
          t.abort();
          return;
        }
        store.put(envelope, "main");
      };
      t.oncomplete = () => resolve();
      t.onerror = t.onabort = () =>
        reject(
          Error(
            conflict
              ? "Records changed in another tab. Lock and unlock to load the latest version."
              : "Could not save records. Nothing was changed.",
          ),
        );
    });
  } finally {
    db.close();
  }
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
