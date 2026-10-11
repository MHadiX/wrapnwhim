import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { unlock, type Envelope } from "./storage";

const COOKIE = "wrapnwhip_session";
const BRANCH = "workspace-data";
const FILE = ".wrapnwhip/workspace.json";
const MAX_BYTES = 4 * 1024 * 1024;
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function settings() {
  const token = process.env.GITHUB_STORAGE_TOKEN;
  const password = process.env.WORKSPACE_PASSWORD;
  const repository =
    process.env.GITHUB_STORAGE_REPOSITORY || "MHadiX/wrapnwhim";
  if (
    !token ||
    !password ||
    password.length < 12 ||
    !/^[\w.-]+\/[\w.-]+$/.test(repository)
  )
    throw new ApiError(
      503,
      "Shared storage is not connected. The site owner must set GITHUB_STORAGE_TOKEN and WORKSPACE_PASSWORD (at least 12 characters) in Vercel, then redeploy.",
    );
  return { token, password, repository };
}
function signature(value: string) {
  const { token, password } = settings();
  const key = createHash("sha256")
    .update(token + "\0" + password)
    .digest();
  return createHmac("sha256", key).update(value).digest("base64url");
}
function equal(a: string, b: string) {
  const hash = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(hash(a), hash(b));
}
export function sessionCookie(request: Request, active: boolean) {
  const value = active ? String(Date.now() + 8 * 60 * 60 * 1000) : "";
  const payload = active ? `${value}.${signature(value)}` : "";
  const host = new URL(
    `http://${request.headers.get("host") || new URL(request.url).host}`,
  ).hostname;
  const secure = ["localhost", "127.0.0.1", "[::1]"].includes(host)
    ? ""
    : "; Secure";
  return `${COOKIE}=${payload}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${active ? 28800 : 0}${secure}`;
}
export function authorize(request: Request) {
  settings();
  const cookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(COOKIE + "="))
    ?.slice(COOKIE.length + 1);
  const parts = cookie?.split(".");
  if (
    !parts ||
    parts.length !== 2 ||
    !/^\d{13}$/.test(parts[0]) ||
    Number(parts[0]) <= Date.now() ||
    !equal(parts[1], signature(parts[0]))
  )
    throw new ApiError(
      401,
      "Your session has expired. Unlock the shared workspace again.",
    );
}
export function sameOrigin(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get("host") || url.host;
  const protocol =
    request.headers.get("x-forwarded-proto") || url.protocol.slice(0, -1);
  if (request.headers.get("origin") !== `${protocol}://${host}`)
    throw new ApiError(
      403,
      "This request must come from your workspace website.",
    );
}
export async function jsonBody(request: Request) {
  if (Number(request.headers.get("content-length") || 0) > MAX_BYTES)
    throw new ApiError(413, "The workspace is too large to save (4 MB limit).");
  const text = await request.text();
  if (Buffer.byteLength(text) > MAX_BYTES)
    throw new ApiError(413, "The workspace is too large to save (4 MB limit).");
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(400, "Invalid request.");
  }
}
export function response(
  value: unknown,
  status = 200,
  headers: HeadersInit = {},
) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}
export function failure(error: unknown) {
  return response(
    {
      error:
        error instanceof ApiError
          ? error.message
          : "Shared storage is unavailable. Nothing was changed; try again.",
    },
    error instanceof ApiError ? error.status : 502,
  );
}
// Instance-local throttling helps with accidental repeated attempts. It is not a distributed rate limiter.
const attempts = new Map<string, { count: number; expires: number }>();
export async function login(request: Request) {
  sameOrigin(request);
  const { password } = settings();
  const address =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const now = Date.now();
  for (const [key, value] of attempts)
    if (value.expires <= now) attempts.delete(key);
  if (attempts.size > 10000)
    throw new ApiError(429, "Too many login attempts. Try again later.");
  const item = attempts.get(address) || {
    count: 0,
    expires: now + 15 * 60 * 1000,
  };
  if (item.count >= 10)
    throw new ApiError(
      429,
      "Too many login attempts. Try again in 15 minutes.",
    );
  const body = await jsonBody(request);
  if (
    typeof body?.password !== "string" ||
    body.password.length > 1024 ||
    !equal(body.password, password)
  ) {
    item.count++;
    attempts.set(address, item);
    throw new ApiError(401, "Incorrect password.");
  }
  attempts.delete(address);
  return response({ ok: true }, 200, {
    "Set-Cookie": sessionCookie(request, true),
  });
}
async function github(path: string, init?: RequestInit) {
  const { token, repository } = settings();
  // Only the explicitly enabled local test fixture can override the API destination.
  const port = process.env.WRAPNWHIP_TEST_GITHUB_PORT;
  const base =
    process.env.WRAPNWHIP_TEST_MODE === "1" && port && /^\d{2,5}$/.test(port)
      ? `http://127.0.0.1:${port}`
      : "https://api.github.com";
  try {
    return await fetch(`${base}/repos/${repository}/${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new ApiError(
      502,
      "Could not reach GitHub shared storage. Your changes were not saved.",
    );
  }
}
function githubError(status: number): never {
  if (status === 401 || status === 403 || status === 404)
    throw new ApiError(
      503,
      "GitHub storage access failed. Check the server token's repository access and Contents read/write permission.",
    );
  throw new ApiError(
    502,
    "GitHub storage is unavailable. Your changes were not saved.",
  );
}
export async function loadShared(): Promise<{
  envelope: Envelope;
  sha: string;
} | null> {
  const r = await github(`contents/${FILE}?ref=${BRANCH}`);
  if (r.status === 404) return null;
  if (!r.ok) githubError(r.status);
  const file = await r.json();
  if (
    file.type !== "file" ||
    typeof file.content !== "string" ||
    file.size > MAX_BYTES ||
    typeof file.sha !== "string"
  )
    throw new ApiError(
      502,
      "The shared storage file is invalid. Restore a verified backup after checking GitHub storage.",
    );
  try {
    const envelope = JSON.parse(
      Buffer.from(file.content, "base64").toString("utf8"),
    );
    checkEnvelope(envelope);
    return { envelope, sha: file.sha };
  } catch {
    throw new ApiError(
      502,
      "The shared storage file is invalid. No records were changed.",
    );
  }
}
function checkEnvelope(value: Envelope) {
  if (
    !value ||
    value.version !== 1 ||
    !Number.isSafeInteger(value.revision) ||
    value.revision < 0 ||
    typeof value.salt !== "string" ||
    typeof value.iv !== "string" ||
    typeof value.ciphertext !== "string" ||
    !/^[A-Za-z0-9+/]+=*$/.test(value.ciphertext) ||
    Buffer.from(value.salt, "base64").length !== 16 ||
    Buffer.from(value.iv, "base64").length !== 12 ||
    Buffer.from(value.ciphertext, "base64").length < 16
  )
    throw new ApiError(400, "Invalid encrypted workspace.");
}
async function ensureBranch() {
  const current = await github(`git/ref/heads/${BRANCH}`);
  if (current.ok) return;
  if (current.status !== 404) githubError(current.status);
  const repo = await github("");
  if (!repo.ok) githubError(repo.status);
  const { default_branch } = await repo.json();
  const main = await github(
    `git/ref/heads/${encodeURIComponent(default_branch)}`,
  );
  if (!main.ok) githubError(main.status);
  const { object } = await main.json();
  const created = await github("git/refs", {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${BRANCH}`, sha: object.sha }),
  });
  if (created.ok) return;
  if (created.status === 422 && (await github(`git/ref/heads/${BRANCH}`)).ok)
    return;
  githubError(created.status);
}
export async function saveShared(envelope: Envelope, expected: number | null) {
  checkEnvelope(envelope);
  if (expected !== null && (!Number.isSafeInteger(expected) || expected < 0))
    throw new ApiError(400, "Invalid expected revision.");
  if (envelope.revision !== (expected === null ? 0 : expected + 1))
    throw new ApiError(400, "Invalid save revision.");
  try {
    await unlock(settings().password, envelope);
  } catch {
    throw new ApiError(
      400,
      "Workspace validation failed. Import backups while signed in so they are encrypted with the shared password.",
    );
  }
  const current = await loadShared();
  const conflict = () => {
    throw new ApiError(
      409,
      "Someone else saved changes first. Refresh the workspace, review their changes, then try again.",
    );
  };
  if ((current?.envelope.revision ?? null) !== expected) conflict();
  if (!current) await ensureBranch();
  const r = await github(`contents/${FILE}`, {
    method: "PUT",
    body: JSON.stringify({
      message: `Save shared workspace revision ${envelope.revision}`,
      content: Buffer.from(JSON.stringify(envelope)).toString("base64"),
      branch: BRANCH,
      ...(current ? { sha: current.sha } : {}),
    }),
  });
  if (r.status === 409 || r.status === 422) conflict();
  if (!r.ok) githubError(r.status);
}
