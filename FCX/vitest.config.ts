import { defineConfig } from "vitest/config";

export default defineConfig({
  define: {
    __FCX_SCRIPT_VERSION__: JSON.stringify("26.1.1"),
    __FCX_UPDATE_MANIFEST_URL__: JSON.stringify(
      "https://fczhushou.com/fcx/version.json",
    ),
    __FCX_UPDATE_HOMEPAGE_URL__: JSON.stringify("https://fczhushou.com/"),
    __FCX_AUTO_UPDATE_CHECK__: JSON.stringify(true),
  },
  test: {
    environment: "happy-dom",
    include: ["tests/**/*.test.ts"],
    restoreMocks: true,
    clearMocks: true,
  },
});
