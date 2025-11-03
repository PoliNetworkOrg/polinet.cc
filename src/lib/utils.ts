import { type ClassValue, clsx } from "clsx"
import { toast } from "sonner"
import { twMerge } from "tailwind-merge"

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
