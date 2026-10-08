import { getPool } from "../../../lib/db/pool";

export async function GET(): Promise<Response> {
  try {
    await getPool().query("SELECT 1");
    return Response.json({ status: "ready" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
