import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { PaginatedUrlsResponse, type UrlsQueryParams } from "@/lib/schemas"

/**
 * The REST API is authenticated via `Authorization: Bearer <token>`. The
 * dashboard calls it as the logged-in user using a token minted for their
 * session (see `admin/page.tsx`); when authentication is disabled for this
 * deployment there is no token, and the API accepts requests without one.
 */
function authHeaders(apiToken?: string): HeadersInit | undefined {
  return apiToken ? { Authorization: `Bearer ${apiToken}` } : undefined
}

async function fetchUrls(params: UrlsQueryParams, apiToken?: string) {
  const queryParams = new URLSearchParams()

  if (params.page) queryParams.set("page", params.page.toString())
  if (params.limit) queryParams.set("limit", params.limit.toString())
  if (params.search) queryParams.set("search", params.search)
  if (params.sortBy) queryParams.set("sortBy", params.sortBy)
  if (params.sortOrder) queryParams.set("sortOrder", params.sortOrder)
  if (params.customOnly) queryParams.set("customOnly", "true")
  if (params.tag) queryParams.set("tag", params.tag)

  const response = await fetch(`/api/urls?${queryParams.toString()}`, {
    headers: authHeaders(apiToken),
  })

  if (!response.ok) {
    throw new Error("Failed to fetch URLs")
  }

  return PaginatedUrlsResponse.parse(await response.json())
}

export function useUrls(params: UrlsQueryParams = {}, apiToken?: string) {
  const keys = Object.values(params).map((value) => value ?? "")
  const query = useQuery({
    queryKey: ["urls", apiToken, ...keys],
    queryFn: () =>
      fetchUrls(params, apiToken)
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

async function fetchAllTags(apiToken?: string): Promise<string[]> {
  const response = await fetch("/api/tags", { headers: authHeaders(apiToken) })
  if (!response.ok) {
    throw new Error("Failed to fetch tags")
  }
  return response.json()
}

export function useAllTags(apiToken?: string) {
  const query = useQuery({
    queryKey: ["tags", apiToken],
    queryFn: () => fetchAllTags(apiToken),
    staleTime: 1000 * 60,
  })

  return {
    tags: query.data ?? [],
    refetch: query.refetch,
  }
}
