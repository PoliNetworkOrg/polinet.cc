import { createEnv } from "@t3-oss/env-nextjs"
import { z } from "zod"

const PORT = 6111

const domainSchema = z
  .string()
  .default(`polinet.cc`)
  .describe(
    "This is the domain to use as shortener. API available at /api and Admin dashboard at /admin"
  )

// coerce is needed for non-string values, because k8s supports only string env
export const env = createEnv({
  client: {
    NEXT_PUBLIC_DOMAIN: domainSchema,
  },
  server: {
    PORT: z.coerce.number().min(1).max(65535).default(PORT),
    NODE_ENV: z.enum(["development", "production"]).default("development"),
    // PUBLIC_URL: z.string().default(`https://polinet.cc`),
    // LOG_LEVEL: z.string().default("DEBUG"),
    DOMAIN: domainSchema,
    DB_HOST: z.string().min(1),
    DB_PORT: z.coerce.number().min(1).max(65535).default(5432),
    DB_USER: z.string().min(1),
    DB_PASS: z.string().min(1),
    DB_NAME: z.string().min(3).default("url_shortener"),
    DB_URL: z.string().url().optional(),
    // Secret key for the HMAC used to derive the daily, per-link visitor hash
    // that estimates unique clicks without cookies. Keep it secret and stable.
    ANALYTICS_HASH_SECRET: z.string().min(16),
    // Optional override for the request header a trusted proxy/CDN uses to
    // expose the visitor's country (e.g. "cf-ipcountry"). When set it is used
    // EXCLUSIVELY (no fallback to other, client-settable headers). Leave unset
    // to trust the built-in edge headers (Cloudflare/Vercel). Country-level
    // only — never city/GPS.
    GEO_COUNTRY_HEADER: z.string().optional(),
    // Optional override for the request header a trusted proxy/CDN uses to
    // expose the visitor's real IP (e.g. "cf-connecting-ip"). When set it is
    // used EXCLUSIVELY (no fallback to client-settable headers like
    // X-Forwarded-For, which the visitor can spoof). Leave unset to trust the
    // built-in edge headers (Cloudflare/Vercel). The IP is used transiently
    // only, to derive the daily unique-visitor hash — never stored or logged.
    TRUSTED_IP_HEADER: z.string().optional(),
    // Bearer token required by GET /api/cron/purge-analytics-dedup, which
    // deletes expired unique-click dedup rows. Recorded clicks purge
    // opportunistically too, but that alone never guarantees the retention
    // window for a link that stops receiving traffic — this endpoint, called
    // on a schedule (see .github/workflows/purge-analytics-dedup.yml), is
    // what actually guarantees it regardless of traffic.
    CRON_SECRET: z.string().min(16).optional(),
  },

  runtimeEnv: {
    PORT: process.env.PORT,
    DOMAIN: process.env.DOMAIN,
    NEXT_PUBLIC_DOMAIN: process.env.DOMAIN,
    DB_HOST: process.env.DB_HOST,
    DB_PORT: process.env.DB_PORT,
    DB_USER: process.env.DB_USER,
    DB_PASS: process.env.DB_PASS,
    DB_NAME: process.env.DB_NAME,
    NODE_ENV: process.env.NODE_ENV,
    DB_URL: process.env.DB_URL,
    ANALYTICS_HASH_SECRET: process.env.ANALYTICS_HASH_SECRET,
    GEO_COUNTRY_HEADER: process.env.GEO_COUNTRY_HEADER,
    TRUSTED_IP_HEADER: process.env.TRUSTED_IP_HEADER,
    CRON_SECRET: process.env.CRON_SECRET,
  },

  /**
   * By default, this library will feed the environment variables directly to
   * the Zod validator.
   *
   * This means that if you have an empty string for a value that is supposed
   * to be a number (e.g. `PORT=` in a ".env" file), Zod will incorrectly flag
   * it as a type mismatch violation. Additionally, if you have an empty string
   * for a value that is supposed to be a string with a default value (e.g.
   * `DOMAIN=` in an ".env" file), the default value will never be applied.
   *
   * In order to solve these issues, we recommend that all new projects
   * explicitly specify this option as true.
   */
  emptyStringAsUndefined: true,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
})
