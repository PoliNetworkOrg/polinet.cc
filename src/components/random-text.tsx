import type React from "react"
import { useEffect, useState } from "react"

export type RandomTextProps = React.HTMLAttributes<HTMLSpanElement> & {
  generate: () => string
  interval?: number
}

export function RandomText({
  generate,
  interval = 60,
  ...props
}: RandomTextProps) {
  const [text, setText] = useState(generate())
  useEffect(() => {
    const id = setInterval(() => {
      setText(generate())
    }, interval)
    return () => clearInterval(id)
  }, [generate, interval])

  return <span {...props}>{text}</span>
}
