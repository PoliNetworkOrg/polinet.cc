"use server"

import nodeCanvas from "canvas"
import { JSDOM } from "jsdom"
import QRCodeStyling, {
  type FileExtension,
  type Options,
} from "qr-code-styling"
import logo from "@/assets/logo.svg"
import { makeOptions, type QrOptions } from "./config"

export async function generateQR(
  data: string,
  size: number,
  ext: FileExtension,
  options: Partial<QrOptions>
): Promise<Blob> {
  if (ext === "jpeg") {
    options.background = "white" // JPEG does not support transparency
  }
  const opts = makeOptions(options)
  // const asdf = toServerOptions(opts(data, size))
  const qrCode = new QRCodeStyling(toServerOptions(opts(data, size)))
  const qrData = (await qrCode.getRawData(ext)) as Buffer<ArrayBuffer>
  if (!qrData) {
    throw new Error("Failed to generate QR code")
  }
  return new Blob([qrData], { type: getMimeType(ext) })
}

function toServerOptions(options: Options): Options {
  const image = options.image ? logo : undefined
  console.log("Using logo:", image)
  console.log("Options:", options)
  return {
    ...options,
    nodeCanvas,
    jsdom: JSDOM,
    image,
    imageOptions: {
      ...options.imageOptions,
      saveAsBlob: true,
    },
  }
}

function getMimeType(ext: FileExtension): string {
  switch (ext) {
    case "png":
      return "image/png"
    case "svg":
      return "image/svg+xml"
    case "jpeg":
      return "image/jpeg"
    case "webp":
      return "image/webp"
    default:
      return "application/octet-stream"
  }
}
