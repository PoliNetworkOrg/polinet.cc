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
    // OIDC login is optional: leave these empty to disable the /admin auth flow entirely
    NEXT_PUBLIC_OIDC_URL: z.string().url().optional(),
    NEXT_PUBLIC_OIDC_CLIENT_ID: z.string().optional(),
    NEXT_PUBLIC_OIDC_SCOPE: z.string().default("openid profile email"),
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
    // Role mapping: ROLES_CLAIM is the OIDC claim (from the ID token or the
    // userinfo endpoint) holding the user's roles, ROLE_ADMIN/ROLE_VIEWER are
    // the claim values mapped to the internal roles. When any of the three is
    // left unset the mapping is disabled and every logged in user is an admin.
    ROLES_CLAIM: z.string().optional(),
    ROLE_ADMIN: z.string().optional(),
    ROLE_VIEWER: z.string().optional(),
  },

  runtimeEnv: {
    PORT: process.env.PORT,
    DOMAIN: process.env.DOMAIN,
    NEXT_PUBLIC_DOMAIN: process.env.DOMAIN,
    NEXT_PUBLIC_OIDC_URL: process.env.OIDC_URL,
    NEXT_PUBLIC_OIDC_CLIENT_ID: process.env.OIDC_CLIENT_ID,
    NEXT_PUBLIC_OIDC_SCOPE: process.env.OIDC_SCOPE,
    DB_HOST: process.env.DB_HOST,
    DB_PORT: process.env.DB_PORT,
    DB_USER: process.env.DB_USER,
    DB_PASS: process.env.DB_PASS,
    DB_NAME: process.env.DB_NAME,
    NODE_ENV: process.env.NODE_ENV,
    DB_URL: process.env.DB_URL,
    ROLES_CLAIM: process.env.ROLES_CLAIM,
    ROLE_ADMIN: process.env.ROLE_ADMIN,
    ROLE_VIEWER: process.env.ROLE_VIEWER,
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
