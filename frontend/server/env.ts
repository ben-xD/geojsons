import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import * as v from "valibot";
import { serverEnvSchema } from "./envSchema.js";

const serverDir = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(serverDir, ".env"), quiet: true });
// Reuse frontend .env for convenience for now.
loadEnv({ path: path.resolve(serverDir, "../.env"), quiet: true });

function issuePath(issue: { path?: Array<{ key?: unknown }> }): string {
  if (!issue.path || issue.path.length === 0) return "<root>";
  return issue.path
    .map((segment) => (segment.key === undefined ? "?" : String(segment.key)))
    .join(".");
}

function formatIssue(issue: { message: string; path?: Array<{ key?: unknown }> }): string {
  return `- ${issuePath(issue)}: ${issue.message}`;
}

const parsedResult = v.safeParse(serverEnvSchema, process.env);
if (!parsedResult.success) {
  const lines = parsedResult.issues.map(formatIssue).join("\n");
  console.error(`\nInvalid server environment configuration:\n${lines}\n`);
  throw new Error("Invalid server environment configuration");
}

const parsed = parsedResult.output;

const port = Number.parseInt(parsed.PORT, 10);
if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  throw new Error(`Invalid PORT value: ${parsed.PORT}`);
}

const logVerbose = parsed.LOG_VERBOSE === "1" || parsed.LOG_VERBOSE.toLowerCase() === "true";

export const env = {
  PORT: port,
  LOG_VERBOSE: logVerbose,
  ARCGIS_API_KEY: parsed.VITE_ARCGIS_API_KEY,
};
