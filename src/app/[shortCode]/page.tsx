import { notFound, RedirectType, redirect } from "next/navigation"
import { urlService } from "@/lib/url-service"

interface Props {
  params: Promise<{
    shortCode: string
  }>
}

export default async function RedirectPage({ params }: Props) {
  const { shortCode } = await params

  const urlRecord = await urlService.getUrlByShortCode(shortCode)
  if (!urlRecord) {
    notFound()
  }

  urlService.incrementClickCount(shortCode).catch(console.error)
  redirect(urlRecord.original_url, RedirectType.push)
}
