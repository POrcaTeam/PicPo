import react from "@vitejs/plugin-react";
import path, { resolve } from "path";
import { ManifestV3Export } from "@crxjs/vite-plugin";
import { viteStaticCopy } from "vite-plugin-static-copy";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, BuildOptions } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { stripDevIcons, crxI18n } from "./custom-vite-plugins";
import manifest from "./manifest.json";
import devManifest from "./manifest.dev.json";
import pkg from "./package.json";

const isDev = process.env.__DEV__ === "true";
// set this flag to true, if you want localization support
const localize = false;

export const baseManifest = {
  ...manifest,
  version: pkg.version,
  ...(isDev ? devManifest : ({} as ManifestV3Export)),
  ...(localize
    ? {
        name: "__MSG_extName__",
        description: "__MSG_extDescription__",
        default_locale: "en",
      }
    : {}),
} as ManifestV3Export;

export const baseBuildOptions: BuildOptions = {
  sourcemap: isDev,
  emptyOutDir: !isDev,
  rollupOptions: {
    input: {
      // 额外入口，单独打包
      port: resolve(__dirname, "src/utils/port.ts"),
      // 额外入口，单独打包
      zip: resolve(__dirname, "src/utils/worker-zip.ts"),
    },
    output: {
      entryFileNames: (chunk) => {
        // 让 port.ts 编译后变成 /port.js
        if (chunk.name === "port") return "port.js";
        if (chunk.name === "zip") return "zip.js";
        return "[name].js";
      },
    },
  },
};

export default defineConfig({
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: "src/utils/port.ts",
          dest: "", // 输出到 dist 根目录
        },
      ],
    }),
    tailwindcss(),
    tsconfigPaths(),
    react(),
    stripDevIcons(isDev),
    crxI18n({ localize, src: "./src/locales" }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  publicDir: resolve(__dirname, "public"),
});
