import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4"
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

describe("form parsing", () => {
  // `@conform-to/zod` without a subpath targets Zod 3 and throws on Zod 4
  // errors, so the forms must import `@conform-to/zod/v4`
  it("reports field errors for invalid submissions", () => {
    const formData = new FormData()
    formData.set("url", "javascript:alert(1)")
    formData.set("shortCode", "x")

    const submission = parseWithZod(formData, { schema: createUrlSchema })

    expect(submission.status).toBe("error")
    expect(submission.reply().error).toEqual({
      url: ["URL must start with http:// or https://"],
      shortCode: ["Short code must be at least 2 characters"],
    })
  })

  it("parses valid submissions", () => {
    const formData = new FormData()
    formData.set("url", "https://example.com")
    formData.append("tags", "a")

    const submission = parseWithZod(formData, { schema: createUrlSchema })

    expect(submission.status).toBe("success")
    expect(submission.status === "success" && submission.value).toEqual({
      url: "https://example.com",
      aliases: [],
      tags: ["a"],
    })
  })

  it("derives HTML constraints for the form inputs", () => {
    const constraint = getZodConstraint(createUrlSchema)

    expect(constraint.url).toEqual({ required: true })
    expect(constraint.shortCode).toEqual({
      required: false,
      minLength: 2,
      maxLength: 25,
    })
    expect(constraint["tags[]"]).toEqual({
      required: true,
      minLength: 1,
      maxLength: 50,
    })
  })
})
