import { getMedicineUsagePage } from "../../../../lib/db/medicine-usage";

export async function GET(request: Request): Promise<Response> {
  const search = new URL(request.url).searchParams;
  const page = Number(search.get("page") ?? "1");
  const pageSize = Number(search.get("pageSize") ?? "50");
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    !Number.isSafeInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 50
  ) {
    return Response.json(
      {
        error: {
          code: "INVALID_QUERY",
          message: "分頁條件無效，請重新選擇頁碼。",
        },
      },
      { status: 400 },
    );
  }
  try {
    return Response.json(await getMedicineUsagePage(page, pageSize));
  } catch {
    return Response.json(
      {
        error: {
          code: "SERVICE_UNAVAILABLE",
          message: "藥品使用量資料暫時無法使用，請稍後再試。",
        },
      },
      { status: 503 },
    );
  }
}
