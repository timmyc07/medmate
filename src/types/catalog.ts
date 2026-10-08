/** 藥局公開資料的前端/API 共用 DTO。 */
export interface Pharmacy {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  city: string | null;
  status: string | null;
  sourceUpdatedAt: string | null;
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
