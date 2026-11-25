import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  { ignores: [".next/**", "node_modules/**", "referencias/**", "coverage/**", "playwright-report/**"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  { rules: { "no-console": ["error", { allow: ["warn", "error"] }] } },
  { files: ["tools/**/*.ts"], rules: { "no-console": "off" } },
];
export default config;
