import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { POST, DELETE } from "../../src/app/api/session/route";
import { GET, PUT } from "../../src/app/api/workspace/route";
import { create, seal } from "../../src/lib/storage";
import { empty, add } from "../../src/lib/finance";
const sample = (description: string) =>
  add(empty(), {
    kind: "income",
    amount: "100",
    date: new Date().toISOString().slice(0, 10),
    description,
    category: "General",
  });
const password = "shared-test-password-only";
const origin = "https://business.example";
let file: { content: string; sha: string; type: string; size: number } | null;
let branch: boolean;
let serial: number;
let cookie: string;
function request(
  path: string,
  method = "GET",
  body?: unknown,
  useCookie = true,
) {
  return new Request(origin + path, {
    method,
    headers: {
      origin,
      ...(useCookie ? { cookie } : {}),
      "Content-Type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
beforeEach(async () => {
  file = null;
  branch = false;
  serial = 0;
  vi.stubEnv("WORKSPACE_PASSWORD", password);
  vi.stubEnv("GITHUB_STORAGE_TOKEN", "test-token-not-real");
  vi.stubEnv("GITHUB_STORAGE_REPOSITORY", "MHadiX/wrapnwhim");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      const path = new URL(input).pathname;
      const reply = (status: number, body: unknown) =>
        Response.json(body, { status });
      if (path.endsWith("/git/ref/heads/workspace-data"))
        return reply(branch ? 200 : 404, {});
      if (path.endsWith("/git/ref/heads/main"))
        return reply(200, { object: { sha: "main" } });
      if (path.endsWith("/git/refs")) {
        branch = true;
        return reply(201, {});
      }
      if (path === "/repos/MHadiX/wrapnwhim")
        return reply(200, { default_branch: "main" });
      if (path.endsWith("/contents/.wrapnwhip/workspace.json")) {
        if (init?.method !== "PUT") return reply(file ? 200 : 404, file || {});
        const body = JSON.parse(init.body as string);
        if ((body.sha ?? null) !== (file?.sha ?? null)) return reply(409, {});
        file = {
          type: "file",
          content: body.content,
          sha: String(++serial),
          size: Buffer.from(body.content, "base64").length,
        };
        return reply(201, {});
      }
      throw Error("Unexpected GitHub call");
    }),
  );
  const logged = await POST(
    request("/api/session", "POST", { password }, false),
  );
  cookie = logged.headers.get("set-cookie")!.split(";")[0];
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("requires authentication and same origin, signs secure HttpOnly cookies and rejects forged sessions", async () => {
  expect(
    (await GET(request("/api/workspace", "GET", undefined, false))).status,
  ).toBe(401);
  const forged = new Request(origin + "/api/workspace", {
    headers: { cookie: cookie.replace(/.$/, "X") },
  });
  expect((await GET(forged)).status).toBe(401);
  const wrong = await POST(
    request("/api/session", "POST", { password: "wrong" }, false),
  );
  expect(wrong.status).toBe(401);
  const external = new Request(origin + "/api/session", {
    method: "POST",
    headers: { origin: "https://attacker.example" },
    body: JSON.stringify({ password }),
  });
  expect((await POST(external)).status).toBe(403);
  const logged = await POST(
    request("/api/session", "POST", { password }, false),
  );
  expect(logged.headers.get("set-cookie")).toMatch(/HttpOnly; SameSite=Strict/);
  expect(logged.headers.get("set-cookie")).toContain("Secure");
  const logout = await DELETE(request("/api/session", "DELETE"));
  expect(logout.headers.get("set-cookie")).toContain("Max-Age=0");
});
it("fails closed without server configuration and never exposes a token", async () => {
  vi.stubEnv("GITHUB_STORAGE_TOKEN", "");
  const r = await GET(request("/api/workspace"));
  expect(r.status).toBe(503);
  expect(await r.text()).not.toContain("test-token-not-real");
});
it("shares only ciphertext, validates accounting before save and rejects damaged ciphertext", async () => {
  const state = sample("Private shared buyer");
  state.revision = 0;
  const result = await create(password, state);
  expect(
    (
      await PUT(
        request("/api/workspace", "PUT", {
          envelope: result.envelope,
          expected: null,
        }),
      )
    ).status,
  ).toBe(200);
  expect(Buffer.from(file!.content, "base64").toString()).not.toContain(
    "Private shared buyer",
  );
  expect(
    (await GET(request("/api/workspace"))).headers.get("cache-control"),
  ).toBe("no-store");
  const damaged = {
    ...result.envelope,
    revision: 1,
    ciphertext: result.envelope.ciphertext.slice(0, -4) + "AAAA",
  };
  expect(
    (
      await PUT(
        request("/api/workspace", "PUT", { envelope: damaged, expected: 0 }),
      )
    ).status,
  ).toBe(400);
  expect(serial).toBe(1);
});
it("uses GitHub SHA compare-and-swap so simultaneous partner saves cannot overwrite each other", async () => {
  const initial = await create(password, empty());
  expect(
    (
      await PUT(
        request("/api/workspace", "PUT", {
          envelope: initial.envelope,
          expected: null,
        }),
      )
    ).status,
  ).toBe(200);
  const a = await seal(
    sample("Partner A buyer"),
    initial.key,
    initial.envelope.salt,
  );
  const b = await seal(
    sample("Partner B buyer"),
    initial.key,
    initial.envelope.salt,
  );
  const results = await Promise.all(
    [a, b].map((envelope) =>
      PUT(request("/api/workspace", "PUT", { envelope, expected: 0 })),
    ),
  );
  expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  expect(serial).toBe(2);
  expect(
    (await PUT(request("/api/workspace", "PUT", { envelope: b, expected: 0 })))
      .status,
  ).toBe(409);
});
it("rejects write attempts from another origin even with a valid cookie", async () => {
  const initial = await create(password, empty());
  const r = new Request(origin + "/api/workspace", {
    method: "PUT",
    headers: { cookie, origin: "https://attacker.example" },
    body: JSON.stringify({ envelope: initial.envelope, expected: null }),
  });
  expect((await PUT(r)).status).toBe(403);
  expect(serial).toBe(0);
});

it("accepts a trusted reverse proxy host without weakening cross-origin checks", async () => {
  const proxied = new Request("http://localhost:3000/api/session", {
    method: "POST",
    headers: { host: "business.example", "x-forwarded-proto": "https", origin },
    body: JSON.stringify({ password }),
  });
  const logged = await POST(proxied);
  expect(logged.status).toBe(200);
  expect(logged.headers.get("set-cookie")).toContain("Secure");
});

it.each([401, 403, 500])(
  "identifies GitHub failure %s without exposing upstream details",
  async (status) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ message: "test-token-not-real" }, { status }),
      ),
    );
    const result = await GET(request("/api/workspace"));
    const body = await result.text();
    expect(body).toContain(String(status));
    expect(body).not.toContain("test-token-not-real");
  },
);
it("explains a workflow permission denial during first storage branch creation", async () => {
  const original = globalThis.fetch;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) =>
      input.endsWith("/git/refs")
        ? Response.json(
            {
              message:
                "refusing to allow a token to create a workflow without workflow permission",
            },
            { status: 403 },
          )
        : original(input, init),
    ),
  );
  const initial = await create(password, empty());
  const result = await PUT(
    request("/api/workspace", "PUT", {
      envelope: initial.envelope,
      expected: null,
    }),
  );
  expect(result.status).toBe(503);
  expect(await result.text()).toContain("Workflows read/write");
  expect(serial).toBe(0);
});
