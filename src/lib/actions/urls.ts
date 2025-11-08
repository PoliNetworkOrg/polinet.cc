"use server"

import type { PaginatedUrlsResponse, UrlsQueryParams } from "../schemas"
import { urlService } from "../url-service"

export async function getAllUrls(
  params: UrlsQueryParams
): Promise<PaginatedUrlsResponse> {
  return await urlService.getAllUrls(params)
}

export async function deleteShortUrl(shortCode: string): Promise<boolean> {
  return await urlService.deleteUrl(shortCode)
}
