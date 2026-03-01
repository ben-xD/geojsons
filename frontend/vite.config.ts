import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import svgr from "vite-plugin-svgr";
import * as v from "valibot";
import { envSchema } from "./src/envSchema";

function validateEnv(): Plugin {
  return {
    name: "validate-env",
    configResolved(config) {
      v.parse(envSchema, config.env);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    validateEnv(),
    tailwindcss(),
    react(),
    svgr({
      svgrOptions: {
        plugins: ["@svgr/plugin-svgo", "@svgr/plugin-jsx"],
        svgoConfig: {
          floatPrecision: 2,
        },
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
