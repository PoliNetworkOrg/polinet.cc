"use client"

import type { Options } from "qr-code-styling"
import QRCodeStyling from "qr-code-styling"
import type React from "react"
import { useCallback, useEffect, useMemo, useRef } from "react"
import { makeOptions, type QrOptions } from "@/lib/qr/config"
import { cn } from "@/lib/utils"

export type QrCodeProps = React.HTMLAttributes<HTMLDivElement> & {
  url: string
  options: QrOptions
  size?: number
  onImageData?: (data: Blob | null) => void
}

export function QrCode({
  url,
  options,
  size = 256,
  onImageData,
  ...props
}: QrCodeProps) {
  const ref = useRef<HTMLDivElement>(null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: biome is wrong
  const opts = useCallback(makeOptions(options), [options])
  const settings = useMemo<Options>(() => opts(url, size), [opts, url, size])

  // biome-ignore lint/correctness/useExhaustiveDependencies: manually updated externally
  const qr = useMemo(() => new QRCodeStyling(settings), [])

  useEffect(() => {
    qr.update(settings)
    qr.getRawData("png").then((data) => {
      onImageData?.(data instanceof Blob ? data : null)
    })
    return () => {
      onImageData?.(null)
    }
  }, [qr, settings, onImageData])

  useEffect(() => {
    if (ref.current) {
      qr.append(ref.current)
    }
    return () => {
      ref.current?.replaceChildren()
    }
  }, [qr])

  return (
    <div className="flex items-center justify-center border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 overflow-hidden">
      <div
        {...props}
        ref={ref}
        id="qr-code-preview-container"
        className={cn(`overflow-hidden bg-muted`, props.className)}
      />
    </div>
  )
}
