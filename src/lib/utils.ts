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

export function relativeTime(date: Date | null | undefined): string {
  if (!date) return "never"
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return date.toLocaleDateString()
}
