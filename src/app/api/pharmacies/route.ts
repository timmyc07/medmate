import { InvalidSearchParamsError, parseSearchParams, type SearchParams } from "../../../lib/api/search-params";
import { searchPharmacies } from "../../../lib/db/pharmacies";

export async function GET(request: Request): Promise<Response> {
  let params: SearchParams;
  try {
    params = parseSearchParams(new URL(request.url).searchParams, true);
  } catch (error) {
    if (error instanceof InvalidSearchParamsError) {
      return Response.json({ error: { code: "INVALID_QUERY", message: error.message } }, { status: 400 });
    }
    throw error;
  }

  try {
    return Response.json(await searchPharmacies(params));
  } catch {
    return Response.json({ error: { code: "SERVICE_UNAVAILABLE", message: "查詢服務暫時無法使用，請稍後再試。" } }, { status: 503 });
  }
}
