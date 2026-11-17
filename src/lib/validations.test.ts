import { describe, expect, it } from "vitest"
import { createUrlSchema, isHttpUrl, updateUrlSchema } from "./validations"

describe("isHttpUrl", () => {
  it("accepts only http and https URLs", () => {
    expect(isHttpUrl("https://example.com/path")).toBe(true)
    expect(isHttpUrl("http://example.com")).toBe(true)
    expect(isHttpUrl("javascript:alert(1)")).toBe(false)
    expect(isHttpUrl("data:text/html,hi")).toBe(false)
    expect(isHttpUrl("not a url")).toBe(false)
  })

  it("rejects non-http(s) targets and unbounded alias lists in API bodies", () => {
    expect(createUrlSchema.safeParse({ url: "https://a.com" }).success).toBe(
      true
    )
    expect(
      createUrlSchema.safeParse({ url: "javascript:alert(1)" }).success
    ).toBe(false)
    expect(
      updateUrlSchema.safeParse({ url: "tg://resolve?domain=x" }).success
    ).toBe(false)

    const aliases = Array.from({ length: 51 }, (_, i) => `alias-${i}`)
    expect(
      createUrlSchema.safeParse({ url: "https://a.com", aliases }).success
    ).toBe(false)
  })
})
