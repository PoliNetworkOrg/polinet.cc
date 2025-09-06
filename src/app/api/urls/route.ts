import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { initDatabase } from "@/lib/db"
import { urlService } from "@/lib/url-service"
import { createUrlSchema } from "@/lib/validations"

// Initialize database on first API call
let dbInitialized = false

async function ensureDbInitialized() {
  if (!dbInitialized) {
    await initDatabase()
    dbInitialized = true
  }
}

export async function GET() {
  try {
    await ensureDbInitialized()
    const urls = await urlService.getAllUrls()
    return NextResponse.json(urls)
  } catch (error) {
    console.error("Error fetching URLs:", error)
    return NextResponse.json({ error: "Failed to fetch URLs" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDbInitialized()
    const body = await request.json()

    const validation = createUrlSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      )
    }

    const urlRecord = await urlService.createShortUrl(validation.data.url)

    return NextResponse.json(
      {
        ...urlRecord,
        shortUrl: `https://tmsu.cc/${urlRecord.short_code}`,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error creating short URL:", error)
    return NextResponse.json(
      { error: "Failed to create short URL" },
      { status: 500 }
    )
  }
}
