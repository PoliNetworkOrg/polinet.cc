import { notFound, redirect } from "next/navigation"
import { urlService } from "@/lib/url-service"

interface Props {
  params: Promise<{
    shortCode: string
  }>
}

export default async function RedirectPage({ params }: Props) {
  const { shortCode } = await params

  try {
    const urlRecord = await urlService.getUrlByShortCode(shortCode)

    if (!urlRecord) {
      notFound()
    }

    // Increment click count asynchronously
    urlService.incrementClickCount(shortCode).catch(console.error)

    // Redirect to the original URL
    redirect(urlRecord.original_url)
  } catch (error) {
    console.error("Error redirecting:", error)
    notFound()
  }
}
