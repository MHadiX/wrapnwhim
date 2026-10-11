import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
let file = null,
  branch = false;
const server = createServer(async (req, res) => {
  const send = (status, data) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  };
  const path = new URL(req.url, "http://127.0.0.1:3001").pathname;
  if (path === "/reset") {
    file = null;
    branch = false;
    return send(200, {});
  }
  if (path === "/inspect") return send(200, file);
  if (req.headers.authorization !== "Bearer test-only-github-token")
    return send(401, {});
  if (path === "/repos/MHadiX/wrapnwhim")
    return send(200, { default_branch: "main" });
  if (path.endsWith("/git/ref/heads/main"))
    return send(200, { object: { sha: "a".repeat(40) } });
  if (path.endsWith("/git/ref/heads/workspace-data"))
    return send(branch ? 200 : 404, { object: { sha: "b".repeat(40) } });
  if (path.endsWith("/git/refs")) {
    if (branch) return send(422, {});
    branch = true;
    return send(201, {});
  }
  if (path.endsWith("/contents/.wrapnwhip/workspace.json")) {
    if (req.method === "GET") return send(file ? 200 : 404, file || {});
    let text = "";
    for await (const chunk of req) text += chunk;
    const body = JSON.parse(text);
    if (!branch || (body.sha ?? null) !== (file?.sha ?? null))
      return send(409, {});
    file = {
      type: "file",
      sha: createHash("sha256").update(body.content).digest("hex"),
      content: body.content,
      size: Buffer.from(body.content, "base64").length,
    };
    return send(201, {});
  }
  send(404, {});
});
await new Promise((resolve) => server.listen(3001, "127.0.0.1", resolve));
const child = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      WORKSPACE_PASSWORD: "test-only-password-2026",
      GITHUB_STORAGE_TOKEN: "test-only-github-token",
      WRAPNWHIP_TEST_MODE: "1",
      WRAPNWHIP_TEST_GITHUB_PORT: "3001",
    },
  },
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    child.kill(signal);
    server.close();
  });
child.on("exit", (code) => {
  server.close();
  process.exitCode = code || 0;
});
