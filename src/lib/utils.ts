import { type ClassValue, clsx } from "clsx"
import { toast } from "sonner"
import { twMerge } from "tailwind-merge"
import { env } from "@/env"
import type { UrlRecord } from "./schemas"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function withPages(current: number, total: number) {
  return Array.from({ length: total }, (_, i) => i + 1)
    .filter((page) => {
      // Show first page, last page, current page, and pages around current
      return page === 1 || page === total || Math.abs(page - current) <= 1
    })
    .map((page, index, arr) => {
      // Add ellipsis if there's a gap
      const prevPage = arr[index - 1]
      const ellipses = !!(prevPage && page - prevPage > 1)

      return {
        page,
        ellipses,
      }
    })
}

export const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    toast.success("Copied to clipboard")
  } catch (error) {
    console.error("Error copying to clipboard:", error)
    toast.error("Failed to copy to clipboard")
  }
}

export function makeShortUrl(url: UrlRecord): string {
  return `https://${env.NEXT_PUBLIC_DOMAIN}/${url.short_code}`
}

const TAG_PALETTE: { bg: string; text: string; border: string }[] = [
  { bg: "#dbeafe", text: "#1e40af", border: "#bfdbfe" }, // blue
  { bg: "#d1fae5", text: "#065f46", border: "#a7f3d0" }, // green
  { bg: "#fce7f3", text: "#9d174d", border: "#fbcfe8" }, // pink
  { bg: "#fef3c7", text: "#92400e", border: "#fde68a" }, // amber
  { bg: "#e0e7ff", text: "#3730a3", border: "#c7d2fe" }, // indigo
  { bg: "#fee2e2", text: "#991b1b", border: "#fecaca" }, // red
  { bg: "#ccfbf1", text: "#134e4a", border: "#99f6e4" }, // teal
  { bg: "#f3e8ff", text: "#6b21a8", border: "#e9d5ff" }, // purple
  { bg: "#ffedd5", text: "#9a3412", border: "#fed7aa" }, // orange
  { bg: "#ecfccb", text: "#365314", border: "#d9f99d" }, // lime
]

function tagHash(tag: string): number {
  let h = 0
  for (let i = 0; i < tag.length; i++) {
    h = (h * 31 + tag.charCodeAt(i)) >>> 0
  }
  return h % TAG_PALETTE.length
}

/** Deterministic color for a tag name — same tag always renders the same color */
export function getTagColor(tag: string) {
  return TAG_PALETTE[tagHash(tag)]
}
