import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { URLRecords, type UrlRecord } from "@/lib/schemas"

export function useUrls() {
  const [urls, setUrls] = useState<UrlRecord[]>([])
  const [loading, setLoading] = useState(true)

  const fetchUrls = useCallback(async () => {
    try {
      const response = await fetch("/api/urls")
      if (response.ok) {
        const data = URLRecords.parse(await response.json())
        setUrls(data)
      } else {
        toast.error("Failed to fetch URLs")
      }
    } catch (error) {
      console.error("Error fetching URLs:", error)
      toast.error("Failed to fetch URLs")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUrls()
  }, [fetchUrls])

  return {
    urls,
    loading,
    fetchUrls,
  }
}
