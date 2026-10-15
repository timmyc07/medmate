/** 藥局公開資料的前端/API 共用 DTO。 */
export interface Pharmacy {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  city: string | null;
  status: string | null;
  openingHours: string | null;
  sourceUpdatedAt: string | null;
  latitude: number | null;
  longitude: number | null;
  distanceKm?: number | null;
  coordinateCandidates?: Array<{ latitude: number; longitude: number; address: string }>;
}

/** 藥品公開資料的前端/API 共用 DTO。 */
export interface Medicine {
  id: string;
  licenseNumber: string;
  name: string;
  indications: string | null;
  usageDosage: string | null;
  ingredients: MedicineIngredient[];
  safetyCommunications: MedicineSafetyCommunication[];
  licenseStatus: string | null;
  validUntil: string | null;
  sourceUpdatedAt: string | null;
  appearance: MedicineAppearance | null;
  price: MedicinePrice[] | null;
}

export interface MedicineAppearance {
  shape: string;
  color: string;
  imprint: string;
  imageUrl: string;
}

export interface MedicinePrice {
  amount: number;
  currency: string;
  type: string;
  drugCode: string;
  specification: string;
  effectiveFrom: string;
  sourceUrl: string;
}

export interface MedicineIngredient {
  prescriptionLabel: string;
  ingredientName: string;
  ingredientCode: string;
  contentDescription: string;
  contentValue: string;
  contentUnit: string;
}

export interface MedicineSafetyCommunication {
  publicationDate: string;
  ingredient: string;
  scopeText: string;
  indications: string;
  mechanism: string;
  reason: string;
  safetyAnalysis: string;
  tfdaCommunication: string;
  sourceUrl: string;
}

export interface MedicineOfficialInformation {
  usageDosage: string | null;
  ingredients: MedicineIngredient[];
  safetyCommunications: MedicineSafetyCommunication[];
}

export interface MedicineUsageItem {
  rank: number;
  drugCode: string;
  name: string;
  englishName: string;
  ingredient: string;
  dosageForm: string;
  claimQuantity: number;
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
