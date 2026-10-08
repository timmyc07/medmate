export interface SearchParams {
  keyword: string;
  city?: string;
  page: number;
  pageSize: number;
}

export class InvalidSearchParamsError extends Error {
  constructor() {
    super("查詢條件無效，請確認搜尋文字與分頁設定。");
    this.name = "InvalidSearchParamsError";
  }
}

export function parseSearchParams(params: URLSearchParams, allowCity = false): SearchParams {
  const keyword = (params.get("q") ?? "").trim();
  const city = (params.get("city") ?? "").trim();
  const page = Number(params.get("page") ?? "1");
  const pageSize = Number(params.get("pageSize") ?? "20");

  if (
    keyword.length === 0 || keyword.length > 100 ||
    (allowCity && city.length > 50) ||
    !Number.isSafeInteger(page) || page < 1 ||
    !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 50
  ) {
    throw new InvalidSearchParamsError();
  }

  return { keyword, ...(allowCity && city ? { city } : {}), page, pageSize };
}
