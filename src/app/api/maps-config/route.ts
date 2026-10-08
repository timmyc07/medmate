export async function GET(): Promise<Response> {
  const key = process.env.GOOGLE_MAP_API_KEY;
  if (!key) return Response.json({ enabled: false });
  return Response.json({ enabled: true, key });
}
