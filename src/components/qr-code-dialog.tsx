"use client"

import { Download } from "lucide-react"
import { useMemo, useState } from "react"
import {
  getDefaultQrOptions,
  QR_OPTIONS,
  type QrOptionKey,
  type QrOptions,
} from "@/lib/qr/config"
import type { UrlRecord } from "@/lib/schemas"
import { makeShortUrl } from "@/lib/utils"
import { QrCode } from "./qr-code"
import { Button } from "./ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog"
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs"

export interface QrCodeDialogProps {
  open: boolean
  url?: UrlRecord
  onOpenChange: (open: boolean) => void
}

export function QrCodeDialog({ open, url, onOpenChange }: QrCodeDialogProps) {
  const [options, setOptions] = useState<QrOptions>(getDefaultQrOptions())
  const [imageData, setImageData] = useState<Blob | null>(null)
  const downloadUrl = useMemo(() => {
    if (imageData) {
      return URL.createObjectURL(imageData)
    }
    return null
  }, [imageData])

  const handleOptionChange = <K extends QrOptionKey>(
    key: K,
    value: QrOptions[K]
  ) => {
    setOptions((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  if (!url) return null
  const shortUrl = makeShortUrl(url)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="md:max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate QR Code</DialogTitle>
          <DialogDescription>
            Create a QR code for{" "}
            <span className="font-mono text-foreground whitespace-nowrap">
              {shortUrl}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col md:flex-row gap-6 p-4">
          {/* Options Panel */}
          <div className="flex flex-col flex-1 space-y-6">
            <h3 className="font-semibold text-sm text-muted-foreground">
              Options
            </h3>

            {Object.entries(QR_OPTIONS).map(([key, config]) => (
              <div key={key} className="flex flex-col space-y-2">
                <div className="text-sm font-medium">{config.label}</div>
                <Tabs
                  value={options[key as QrOptionKey]}
                  onValueChange={(value) =>
                    handleOptionChange(
                      key as QrOptionKey,
                      value as QrOptions[QrOptionKey]
                    )
                  }
                >
                  <TabsList>
                    {config.options.map((option) => (
                      <TabsTrigger
                        key={option}
                        value={option}
                        className="capitalize"
                      >
                        {option}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
                {config.description?.map((desc, idx) => (
                  <p
                    // biome-ignore lint/suspicious/noArrayIndexKey: config description is static
                    key={idx}
                    className="text-xs text-muted-foreground leading-snug opacity-70"
                  >
                    {desc}
                  </p>
                ))}
              </div>
            ))}
          </div>

          {/* Preview Panel */}
          <div className="flex flex-col items-center space-y-4">
            <div className="space-y-2 text-center w-full">
              <h3 className="font-semibold text-sm text-muted-foreground">
                Preview
              </h3>
              <QrCode
                url={shortUrl}
                options={options}
                size={1024}
                onImageData={setImageData}
                className="max-md:w-[150px] max-md:h-[150px] md:w-[300px] md:h-[300px]"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <a
            href={downloadUrl ?? undefined}
            download={
              downloadUrl ? `polinet-qr-${url.short_code}.png` : undefined
            }
          >
            <Button className="w-full" disabled={!downloadUrl}>
              <Download className="h-4 w-4" />
              Download QR Code
            </Button>
          </a>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
