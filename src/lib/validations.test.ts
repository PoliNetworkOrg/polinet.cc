import { describe, expect, it } from "vitest"
import { isHttpUrl } from "./validations"

describe("isHttpUrl", () => {
  it("accepts only http and https URLs", () => {
    expect(isHttpUrl("https://example.com/path")).toBe(true)
    expect(isHttpUrl("http://example.com")).toBe(true)
    expect(isHttpUrl("javascript:alert(1)")).toBe(false)
    expect(isHttpUrl("data:text/html,hi")).toBe(false)
    expect(isHttpUrl("not a url")).toBe(false)
  })
})
