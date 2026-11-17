import { createEnv } from "@t3-oss/env-nextjs"
import { z } from "zod"

const PORT = 6111

// coerce is needed for non-string values, because k8s supports only string env
export const env = createEnv({
  // Everything below is server-side on purpose. `NEXT_PUBLIC_` variables are
  // inlined into the bundle by `next build`, which would bake the values of
  // whoever built the image into it and force every self-hoster to rebuild.
  // Values the browser needs (the shortener domain) are read on the server and
  // handed to client components as props instead.
  client: {},
  server: {
    PORT: z.coerce.number().min(1).max(65535).default(PORT),
    NODE_ENV: z.enum(["development", "production"]).default("development"),
    SESSION_SECRET: z.string().min(32),
    // LOG_LEVEL: z.string().default("DEBUG"),
    DOMAIN: z
      .string()
      .default(`polinet.cc`)
      .describe(
        "This is the domain to use as shortener. API available at /api and Admin dashboard at /admin"
      ),
    DB_HOST: z.string().min(1),
    DB_PORT: z.coerce.number().min(1).max(65535).default(5432),
    DB_USER: z.string().min(1),
    DB_PASS: z.string().min(1),
    DB_NAME: z.string().min(3).default("url_shortener"),
    DB_URL: z.string().url().optional(),
    // OIDC login is optional: leave these empty to disable the /admin auth flow
    // entirely.
    OIDC_URL: z.string().url().optional(),
    OIDC_CLIENT_ID: z.string().optional(),
    OIDC_SCOPE: z.string().default("openid profile email"),
    // Role mapping: ROLES_CLAIM is the OIDC claim (from the ID token or the
    // userinfo endpoint) holding roles or an object with a permissions array.
    // ROLE_ADMIN/ROLE_VIEWER are the values mapped to the internal roles. When
    // any of the three is left unset, every logged in user is an admin.
    ROLES_CLAIM: z.string().optional(),
    ROLE_ADMIN: z.string().optional(),
    ROLE_VIEWER: z.string().optional(),
  },

  runtimeEnv: {
    PORT: process.env.PORT,
    DOMAIN: process.env.DOMAIN,
    OIDC_URL: process.env.OIDC_URL,
    OIDC_CLIENT_ID: process.env.OIDC_CLIENT_ID,
    OIDC_SCOPE: process.env.OIDC_SCOPE,
    SESSION_SECRET: process.env.SESSION_SECRET,
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
