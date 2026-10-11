import {
  authorize,
  failure,
  jsonBody,
  loadShared,
  response,
  sameOrigin,
  saveShared,
} from "@/lib/shared-server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    authorize(request);
    return response({ envelope: (await loadShared())?.envelope ?? null });
  } catch (e) {
    return failure(e);
  }
}
export async function PUT(request: Request) {
  try {
    sameOrigin(request);
    authorize(request);
    const body = await jsonBody(request);
    await saveShared(body.envelope, body.expected);
    return response({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
