import type { FileExtension } from "qr-code-styling"
import { z } from "zod"

export const ImgFileExt = z
  .enum(["png", "jpg", "jpeg", "svg", "webp"])
  .transform((ext) => {
    switch (ext) {
      case "jpg":
        return "jpeg" as const
      default:
        return ext as FileExtension
    }
  })
