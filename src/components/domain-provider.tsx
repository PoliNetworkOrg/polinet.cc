"use client"

import { createContext, type ReactNode, useContext } from "react"

const DomainContext = createContext<string | null>(null)

/**
 * Carries the shortener domain from the server into the client tree. The domain
 * is a deployment-time setting, so client code must never read it from
 * `process.env`: `NEXT_PUBLIC_` values are inlined by `next build` and would
 * pin the published image to whichever domain built it.
 */
export function DomainProvider({
  domain,
  children,
}: {
  domain: string
  children: ReactNode
}) {
  return <DomainContext value={domain}>{children}</DomainContext>
}

export function useDomain(): string {
  const domain = useContext(DomainContext)
  if (domain === null) {
    throw new Error("useDomain must be used inside a DomainProvider")
  }
  return domain
}
