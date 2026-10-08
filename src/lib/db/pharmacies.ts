import "server-only";
import type { SearchParams } from "../api/search-params";
import type { Page, Pharmacy } from "../../types/catalog";

export async function searchPharmacies(_params: SearchParams): Promise<Page<Pharmacy>> {
  throw new Error("DATA_SOURCE_NOT_APPROVED");
}
