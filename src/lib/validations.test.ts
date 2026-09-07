import { describe, expect, it } from "vitest"
import { tagSchema } from "./validations"

describe("tagSchema", () => {
  it("applies length limits after trimming", () => {
    expect(tagSchema.safeParse({ tagName: "   " }).success).toBe(false)

    const tagName = "a".repeat(50)
    expect(tagSchema.parse({ tagName: ` ${tagName} ` }).tagName).toBe(tagName)
  })
})
