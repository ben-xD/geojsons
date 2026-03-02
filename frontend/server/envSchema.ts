import * as v from "valibot";

export const serverEnvSchema = v.object({
  PORT: v.optional(v.pipe(v.string(), v.regex(/^\d+$/, "PORT must be an integer string")), "3456"),
  LOG_VERBOSE: v.optional(
    v.pipe(
      v.string(),
      v.check(
        (input) => ["0", "1", "true", "false"].includes(input.toLowerCase()),
        "LOG_VERBOSE must be one of: 0, 1, true, false",
      ),
    ),
    "false",
  ),
  VITE_ARCGIS_API_KEY: v.pipe(v.string(), v.minLength(1)),
});
