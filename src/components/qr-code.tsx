"use client"

import type { Options } from "qr-code-styling"
import QRCodeStyling from "qr-code-styling"
import type React from "react"
import { useEffect, useMemo, useRef } from "react"
import logo from "@/assets/logo.svg"
import type { QrOptions } from "@/lib/qr-config"
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

  const { style, background } = options
  const styled = style === "styled"

  const settings = useMemo<Options>(() => {
    const color = styled ? "#1156ae" : "#000000"
    return {
      type: "canvas",
      width: size,
      height: size,
      margin: size / 32,
      data: url,
      image: styled ? logo.src : undefined,
      imageOptions: { margin: size / 64 },
      qrOptions: {
        typeNumber: 0,
        mode: "Byte",
        errorCorrectionLevel: styled ? "Q" : "M",
      },
      dotsOptions: {
        color,
        type: styled ? "extra-rounded" : "square",
      },
      cornersDotOptions: {
        color,
      },
      cornersSquareOptions: {
        color,
        type: styled ? "extra-rounded" : "square",
      },
      backgroundOptions: {
        color: background === "white" ? "#ffffff" : "transparent",
      },
    }
  }, [url, styled, background, size])

  // biome-ignore lint/correctness/useExhaustiveDependencies: manually updated externally
  const qr = useMemo(() => new QRCodeStyling(settings), [])

  useEffect(() => {
    qr.update(settings)
    qr.getRawData("png").then((data) => {
      if (onImageData) {
        let blob: Blob | null = null
        if (data instanceof Blob) {
          blob = data
        } else if (data instanceof Buffer) {
          blob = new Blob([new Uint8Array(data)], { type: "image/png" })
        }
        onImageData(blob)
      }
    })
    return () => {
      if (onImageData) {
        onImageData(null)
      }
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
