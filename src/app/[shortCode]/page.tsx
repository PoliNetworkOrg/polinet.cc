import { notFound, RedirectType, redirect } from "next/navigation"
import { urlService } from "@/lib/url-service"
import { isHttpUrl } from "@/lib/validations"

interface Props {
  params: Promise<{
    shortCode: string
  }>
}

export default async function RedirectPage({ params }: Props) {
  const { shortCode } = await params

  // matches the primary code or an alias
  const target = await urlService.resolveClickTarget(shortCode)
  if (!target || !isHttpUrl(target.originalUrl)) {
    notFound()
  }

  urlService.recordClick(target).catch(console.error)
  redirect(target.originalUrl, RedirectType.push)
}
