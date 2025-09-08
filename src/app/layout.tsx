import type { Metadata } from "next"
// import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/sonner"

export const metadata: Metadata = {
  title: "tommaso morganti short urls",
  description: "tommasomorganti.com, but shorter.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
