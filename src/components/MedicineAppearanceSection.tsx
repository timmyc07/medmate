"use client";

import { useRouter } from "next/navigation";
import PillFeatureFinder from "./PillFeatureFinder";

export default function MedicineAppearanceSection() {
  const router = useRouter();

  return (
    <section
      className="medicine-appearance-section"
      aria-labelledby="medicine-appearance-title"
    >
      <div className="section-heading">
        <div>
          <span className="section-index">02</span>
          <h2 id="medicine-appearance-title">藥品外觀特徵辨識</h2>
        </div>
        <span className="section-caption">TFDA APPEARANCE DATA</span>
      </div>
      <PillFeatureFinder
        onCompare={(marking) => {
          router.push(`/medicines?q=${encodeURIComponent(marking)}`);
        }}
      />
      <p className="appearance-source-note">
        外觀特徵與刻字僅供初步比對，實際用藥前請核對藥袋、許可證資訊並諮詢藥師。
      </p>
    </section>
  );
}
