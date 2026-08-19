import { describe, expect, it } from "vitest"
import { getCountryFromHeaders, UNKNOWN_COUNTRY } from "./geo"

function headers(map: Record<string, string>) {
  return { get: (name: string) => map[name.toLowerCase()] ?? null }
}

describe("getCountryFromHeaders", () => {
  it("reads a Cloudflare country header", () => {
    expect(getCountryFromHeaders(headers({ "cf-ipcountry": "US" }))).toBe("US")
  })

  it("reads a Vercel country header and uppercases it", () => {
    expect(
      getCountryFromHeaders(headers({ "x-vercel-ip-country": "fr" }))
    ).toBe("FR")
  })

  it("returns Unknown when no geo header is present", () => {
    expect(getCountryFromHeaders(headers({}))).toBe(UNKNOWN_COUNTRY)
  })

  it("treats proxy 'no country' sentinels as Unknown", () => {
    expect(getCountryFromHeaders(headers({ "cf-ipcountry": "XX" }))).toBe(
      UNKNOWN_COUNTRY
    )
    expect(getCountryFromHeaders(headers({ "cf-ipcountry": "T1" }))).toBe(
      UNKNOWN_COUNTRY
    )
  })

  it("rejects malformed country values", () => {
    expect(
      getCountryFromHeaders(headers({ "cf-ipcountry": "United States" }))
    ).toBe(UNKNOWN_COUNTRY)
  })
})
