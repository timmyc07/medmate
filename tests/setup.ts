import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("next/font/google", () => ({
  Plus_Jakarta_Sans: () => ({ variable: "font-display" }),
  Nunito_Sans: () => ({ variable: "font-body" }),
}));
