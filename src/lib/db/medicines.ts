import "server-only";
import type { SearchParams } from "../api/search-params";
import type { Medicine, Page } from "../../types/catalog";

export async function searchMedicines(_params: SearchParams): Promise<Page<Medicine>> {
  throw new Error("DATA_SOURCE_NOT_APPROVED");
}
