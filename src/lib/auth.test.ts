import { afterEach, describe, expect, it, vi } from "vitest"

/**
 * `rolesConfig` is read from the environment at module load, so every case
 * stubs the env and imports a fresh copy of the module.
 */
async function importAuth(roleEnv: Record<string, string | undefined>) {
  vi.resetModules()
  for (const [key, value] of Object.entries(roleEnv)) {
    if (value === undefined) vi.stubEnv(key, "")
    else vi.stubEnv(key, value)
  }
  return await import("./auth")
}

const FULL_MAPPING = {
  ROLES_CLAIM: "roles",
  ROLE_ADMIN: "shortener-admin",
  ROLE_VIEWER: "shortener-viewer",
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("resolveRole", () => {
  it("treats everybody as an admin when the mapping is not configured", async () => {
    const { resolveRole, isRoleMappingEnabled } = await importAuth({
      ROLES_CLAIM: undefined,
      ROLE_ADMIN: undefined,
      ROLE_VIEWER: undefined,
    })
    expect(isRoleMappingEnabled).toBe(false)
    expect(resolveRole({})).toBe("admin")
    expect(resolveRole({ roles: ["whatever"] })).toBe("admin")
  })

  it("treats everybody as an admin when the mapping is incomplete", async () => {
    const { resolveRole } = await importAuth({
      ...FULL_MAPPING,
      ROLE_VIEWER: undefined,
    })
    expect(resolveRole({ roles: ["shortener-admin"] })).toBe("admin")
    expect(resolveRole({ roles: ["nothing"] })).toBe("admin")
  })

  it("maps the configured claim values onto the internal roles", async () => {
    const { resolveRole } = await importAuth(FULL_MAPPING)
    expect(resolveRole({ roles: ["shortener-admin"] })).toBe("admin")
    expect(resolveRole({ roles: ["shortener-viewer"] })).toBe("viewer")
    expect(resolveRole({ roles: "shortener-viewer" })).toBe("viewer")
    expect(resolveRole({ roles: "other shortener-viewer" })).toBe("viewer")
  })

  it("prefers admin when the user carries both roles", async () => {
    const { resolveRole } = await importAuth(FULL_MAPPING)
    expect(
      resolveRole({ roles: ["shortener-viewer", "shortener-admin"] })
    ).toBe("admin")
  })

  it("gives no role when the claim is missing or unmapped", async () => {
    const { resolveRole } = await importAuth(FULL_MAPPING)
    expect(resolveRole({})).toBeNull()
    expect(resolveRole({ roles: [] })).toBeNull()
    expect(resolveRole({ roles: ["unrelated"] })).toBeNull()
    expect(resolveRole({ groups: ["shortener-admin"] })).toBeNull()
    expect(resolveRole({ roles: 42 })).toBeNull()
  })
})

describe("canRead / canWrite", () => {
  it("lets both roles read and only admins write", async () => {
    const { canRead, canWrite } = await importAuth(FULL_MAPPING)
    expect(canRead("admin")).toBe(true)
    expect(canRead("viewer")).toBe(true)
    expect(canRead(null)).toBe(false)
    expect(canWrite("admin")).toBe(true)
    expect(canWrite("viewer")).toBe(false)
    expect(canWrite(null)).toBe(false)
  })
})
