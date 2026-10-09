-- 健保特約藥局資料的固定看診時段；來源沒有精確鐘點，故保存原文供前端說明。
ALTER TABLE pharmacy_contracts ADD COLUMN IF NOT EXISTS opening_hours text;
