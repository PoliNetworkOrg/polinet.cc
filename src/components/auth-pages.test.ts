import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const componentsDirectory = resolve(process.cwd(), "src/components")

function readComponent(fileName: string) {
  return readFileSync(resolve(componentsDirectory, fileName), "utf8")
}

describe("auth page layout", () => {
  it.each(["login-page.tsx", "no-access-page.tsx"])(
    "uses the shared auth card in %s",
    (fileName) => {
      const source = readComponent(fileName)

      expect(source).toContain('from "@/components/auth-card"')
      expect(source).toContain("<AuthCard")
    }
  )

  it("keeps long identities inside the card and centers the logo", () => {
    const source = readComponent("auth-card.tsx")

    expect(source).toContain("min-w-0")
    expect(source).toContain("justify-items-center")
    expect(source).toContain("max-w-full")
    expect(source).toContain("break-words")
  })
})
