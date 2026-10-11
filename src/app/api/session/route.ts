import {
  failure,
  login,
  response,
  sameOrigin,
  sessionCookie,
} from "@/lib/shared-server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    return await login(request);
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE(request: Request) {
  try {
    sameOrigin(request);
    return response({ ok: true }, 200, {
      "Set-Cookie": sessionCookie(request, false),
    });
  } catch (e) {
    return failure(e);
  }
}
