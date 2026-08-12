import react from "@vitejs/plugin-react";
import { ViteUserConfig, defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [react()] as ViteUserConfig["plugins"],
    test: {
        include: ["**/*.{test,spec}.{js,ts,tsx}"],
        environment: "jsdom",
        setupFiles: ["vitestSetup.ts"],
    },
});
