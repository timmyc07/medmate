/** 藥局公開資料的前端/API 共用 DTO。 */
export interface Pharmacy {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  city: string | null;
  status: string | null;
  sourceUpdatedAt: string | null;
  latitude: number | null;
  longitude: number | null;
  distanceKm?: number | null;
}

/** 藥品公開資料的前端/API 共用 DTO。 */
export interface Medicine {
  id: string;
  licenseNumber: string;
  name: string;
  indications: string | null;
  licenseStatus: string | null;
  validUntil: string | null;
  sourceUpdatedAt: string | null;
}

export interface MedicineUsageItem {
  rank: number;
  drugCode: string;
  name: string;
  englishName: string;
  ingredient: string;
  dosageForm: string;
  claimQuantity: number;
  licenseNumber: string | null;
  appearanceImageUrl: string | null;
  appearanceShape: string | null;
  appearanceColor: string | null;
}

export interface MedicineUsagePage {
  items: MedicineUsageItem[];
  page: number;
  pageSize: number;
  total: number;
  feeYear: number | null;
  periodStart: string | null;
  periodEnd: string | null;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}
