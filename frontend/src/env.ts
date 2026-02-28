import { envSchema } from "./envSchema";

// Limit usage of import.meta.env to this file. Don't use it outside, to keep it readable.
export const env = envSchema.parse(import.meta.env);
