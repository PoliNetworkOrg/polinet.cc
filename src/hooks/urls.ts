import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  AnalyticsResult,
  PaginatedUrlsResponse,
  type UrlsQueryParams,
} from "@/lib/schemas"

async function fetchUrls(params: UrlsQueryParams) {
  const queryParams = new URLSearchParams()

  if (params.page) queryParams.set("page", params.page.toString())
  if (params.limit) queryParams.set("limit", params.limit.toString())
  if (params.search) queryParams.set("search", params.search)
  if (params.sortBy) queryParams.set("sortBy", params.sortBy)
  if (params.sortOrder) queryParams.set("sortOrder", params.sortOrder)
  if (params.customOnly) queryParams.set("customOnly", "true")
  if (params.tag) queryParams.set("tag", params.tag)

  const response = await fetch(`/api/urls?${queryParams.toString()}`)

  if (!response.ok) {
    throw new Error("Failed to fetch URLs")
  }

  return PaginatedUrlsResponse.parse(await response.json())
}

export function useUrls(params: UrlsQueryParams = {}) {
  const keys = Object.values(params).map((value) => value ?? "")
  const query = useQuery({
    queryKey: ["urls", ...keys],
    queryFn: () =>
      fetchUrls(params)
        .then((d) => {
          console.log(d)
          return d
        })
        .catch((error) => {
          console.error("Error fetching URLs:", error)
          throw error
        }),
    staleTime: 1000 * 60, // 1 minute
  })

  if (query.error) {
    toast.error("Failed to fetch URLs")
  }

  return {
    urls: query.data?.urls ?? [],
    pagination: query.data?.pagination,
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}

async function fetchAnalytics(shortCode: string) {
  const response = await fetch(`/api/urls/${shortCode}/analytics`)
  if (!response.ok) {
    throw new Error("Failed to fetch analytics")
  }
  return AnalyticsResult.parse(await response.json())
}

export function useAnalytics(shortCode: string | undefined, enabled: boolean) {
  const query = useQuery({
    queryKey: ["analytics", shortCode],
    queryFn: () => fetchAnalytics(shortCode as string),
    enabled: enabled && !!shortCode,
    staleTime: 1000 * 30,
  })
  return {
    analytics: query.data,
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}

async function fetchAllTags(): Promise<string[]> {
  const response = await fetch("/api/tags")
  if (!response.ok) {
    throw new Error("Failed to fetch tags")
  }
  return response.json()
}

export function useAllTags() {
  const query = useQuery({
    queryKey: ["tags"],
    queryFn: fetchAllTags,
    staleTime: 1000 * 60,
  })

  return {
    tags: query.data ?? [],
    refetch: query.refetch,
  }
}
