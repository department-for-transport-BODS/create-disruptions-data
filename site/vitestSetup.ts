// vitestSetup.ts
import { beforeAll, vi } from "vitest";

// Set environment variables for tests before any imports
process.env.SUPPORT_PHONE = "0800 000 000";
process.env.SUPPORT_EMAIL = "bodshelpdesk@kainos.com";

beforeAll(() => {
    vi.mock("next/router", () => require("next-router-mock"));
});
