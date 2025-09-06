import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { urlService } from "@/lib/url-service"
import { updateUrlSchema } from "@/lib/validations"

/**
 *
 *
 *
 *
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ shortCode: string }> }
) {
  try {
    const { shortCode } = await params
    const urlRecord = await urlService.getUrlByShortCode(shortCode)

    if (!urlRecord) {
      return NextResponse.json({ error: "URL not found" }, { status: 404 })
    }

    return NextResponse.json(urlRecord)
  } catch (error) {
    console.error("Error fetching URL:", error)
    return NextResponse.json({ error: "Failed to fetch URL" }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ shortCode: string }> }
) {
  try {
    const { shortCode } = await params
    const body = await request.json()

    const validation = updateUrlSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      )
    }

    if (!validation.data.url) {
      return NextResponse.json(
        { error: "URL is required for update" },
        { status: 400 }
      )
    }

    const urlRecord = await urlService.updateUrl(shortCode, validation.data.url)

    if (!urlRecord) {
      return NextResponse.json({ error: "URL not found" }, { status: 404 })
    }

    return NextResponse.json({
      ...urlRecord,
      shortUrl: `https://tmsu.cc/${urlRecord.short_code}`,
    })
  } catch (error) {
    console.error("Error updating URL:", error)
    return NextResponse.json({ error: "Failed to update URL" }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ shortCode: string }> }
) {
  try {
    const { shortCode } = await params
    const success = await urlService.deleteUrl(shortCode)

    if (!success) {
      return NextResponse.json({ error: "URL not found" }, { status: 404 })
    }

    return NextResponse.json({ message: "URL deleted successfully" })
  } catch (error) {
    console.error("Error deleting URL:", error)
    return NextResponse.json({ error: "Failed to delete URL" }, { status: 500 })
  }
}
