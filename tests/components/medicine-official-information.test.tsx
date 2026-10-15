import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MedicineResult } from "../../src/components/ResultCard";

afterEach(cleanup);

describe("藥品卡片官方資訊", () => {
  it("展開時顯示官方用法、完整成分與精確關聯的安全公告原文", () => {
    render(<MedicineResult item={{
      id: "衛部藥製字第000001號",
      licenseNumber: "衛部藥製字第000001號",
      name: "測試藥品",
      indications: "核准適應症原文",
      usageDosage: "每日一次，依醫囑使用。",
      ingredients: [{ prescriptionLabel: "每錠", ingredientName: "成分甲", ingredientCode: "A1", contentDescription: "250 毫克", contentValue: "250", contentUnit: "毫克" }],
      safetyCommunications: [{ publicationDate: "2026-01-02", ingredient: "成分甲", scopeText: "測試藥品（衛部藥製字第000001號）", indications: "公告適應症", mechanism: "公告作用機轉", reason: "安全性訊息", safetyAnalysis: "TFDA 安全公告原文。", tfdaCommunication: "請依公告內容辦理。", sourceUrl: "https://data.fda.gov.tw/data/opendata/export/53/csv" }],
      licenseStatus: "有效",
      validUntil: "2099-01-01",
      sourceUpdatedAt: "2026-01-01",
      appearance: null, price: null,
    }} />);

    fireEvent.click(screen.getByText("查看官方用藥與安全資料"));
    expect(screen.getByText("每日一次，依醫囑使用。", { exact: false })).toBeInTheDocument();
    expect(screen.getByText(/每錠｜成分甲/)).toBeInTheDocument();
    expect(screen.getByText(/公告涵蓋範圍：測試藥品（衛部藥製字第000001號）/)).toBeInTheDocument();
    expect(screen.getByText(/公告適應症/)).toBeInTheDocument();
    expect(screen.getByText(/公告作用機轉/)).toBeInTheDocument();
    expect(screen.getByText("TFDA 安全公告原文。", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "TFDA 公告來源" })).toHaveAttribute("href", "https://data.fda.gov.tw/data/opendata/export/53/csv");
  });

  it("來源沒有可精確對應的資料時明確標示未提供且不推測安全資訊", () => {
    render(<MedicineResult item={{
      id: "A2", licenseNumber: "A2", name: "沒有詳細資料的藥品", indications: null,
      usageDosage: null, ingredients: [], safetyCommunications: [],
      licenseStatus: "有效", validUntil: null, sourceUpdatedAt: null,
      appearance: null, price: null,
    }} />);

    fireEvent.click(screen.getByText("查看官方用藥與安全資料"));
    expect(screen.getByText("官方資料未提供此藥品的用法用量。", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("目前沒有可用完整許可證字號精確配對的安全公告。", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("副作用、禁忌與交互作用資料未由目前來源提供；請洽藥師或醫療人員。", { exact: false })).toBeInTheDocument();
  });
});
