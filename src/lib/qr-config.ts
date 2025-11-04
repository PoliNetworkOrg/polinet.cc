/**
 * Single source of truth for QR Code generation options
 */

export interface QrOptionConfig<T extends string> {
  label: string
  options: readonly T[]
  default: T
  description?: string[]
}

export const QR_OPTIONS = {
  style: {
    label: "Style",
    options: ["plain", "styled"] as const,
    default: "plain" as const,
    description: [
      "A styled QR code will use a more aggressive error correction level to include the logo in the center.",
    ] as const,
  },
  background: {
    label: "Background",
    options: ["white", "transparent"] as const,
    default: "white" as const,
    description: [
      "Transparent background should be used when placing the QR code on colored surfaces (like in a powerpoint presentation).",
      "When using a transparent background: always use high-contrast backgrounds and make sure the QR code is easily scannable in its final context.",
    ] as const,
  },
} as const satisfies Record<string, QrOptionConfig<string>>

// Derive TypeScript types from the configuration
export type QrOptionKey = keyof typeof QR_OPTIONS
export type QrOptionValue<K extends QrOptionKey> =
  (typeof QR_OPTIONS)[K]["options"][number]

export type QrOptions = {
  [K in QrOptionKey]: QrOptionValue<K>
}

// Helper to get default options
export function getDefaultQrOptions(): QrOptions {
  return Object.fromEntries(
    Object.entries(QR_OPTIONS).map(([key, config]) => [key, config.default])
  ) as QrOptions
}
