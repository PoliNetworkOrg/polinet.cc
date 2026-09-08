"use client"

import { getFormProps, getInputProps, useForm } from "@conform-to/react"
import { getZodConstraint, parseWithZod } from "@conform-to/zod"
import { X } from "lucide-react"
import { nanoid } from "nanoid"
import { useActionState, useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { env } from "@/env"
import { createUrl } from "@/lib/actions"
import { getTagColor } from "@/lib/utils"
import { createUrlSchema } from "@/lib/validations"
import { RandomText } from "./random-text"

interface CreateUrlDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

/** Inline tag chip input — Enter or comma adds a tag */
function TagChipInput({
  tags,
  onChange,
}: {
  tags: string[]
  onChange: (tags: string[]) => void
}) {
  const [input, setInput] = useState("")
  const [error, setError] = useState<string | null>(null)

  const add = () => {
    const trimmed = input.trim().replace(/,+$/, "")
    if (!trimmed) return
    if (trimmed.length > 50) {
      setError("Tag must be at most 50 characters")
      return
    }
    if (tags.includes(trimmed)) {
      setError("Tag already added")
      return
    }
    onChange([...tags, trimmed])
    setInput("")
    setError(null)
  }

  const remove = (tag: string) => onChange(tags.filter((t) => t !== tag))

  return (
    <div className="col-span-3 space-y-2">
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            setError(null)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault()
              add()
            }
          }}
          placeholder="e.g. events, forms…"
          className="flex-1"
          maxLength={51}
        />
        <Button type="button" variant="outline" size="sm" onClick={add}>
          Add
        </Button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map((tag) => {
            const c = getTagColor(tag)
            return (
              <span
                key={tag}
                style={{
                  backgroundColor: c.bg,
                  color: c.text,
                  border: `1px solid ${c.border}`,
                }}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => remove(tag)}
                  className="hover:opacity-70"
                  aria-label={`Remove tag ${tag}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function CreateUrlDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateUrlDialogProps) {
  const [{ error, lastResult }, action, pending] = useActionState(createUrl, {
    error: null,
    lastResult: null,
  })
  const [tags, setTags] = useState<string[]>([])
  const [form, fields] = useForm({
    lastResult,
    constraint: getZodConstraint(createUrlSchema),
    onValidate: ({ formData }) =>
      parseWithZod(formData, { schema: createUrlSchema }),
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
  })

  const onSuccessRef = useRef(onSuccess)
  useEffect(() => {
    onSuccessRef.current = onSuccess
  })

  useEffect(() => {
    if (lastResult && form.status === "success") {
      toast.success("Short URL created successfully!")
      setTags([])
      onSuccessRef.current()
    } else if (lastResult && error) {
      console.error("Error creating URL:", error)
      toast.error(`Error creating URL: ${error}`)
    }
  }, [lastResult, error, form.status])

  useEffect(() => {
    if (!open) setTags([])
  }, [open])

  const randomCode = useCallback(() => nanoid(8), [])
  const isRandom = !(fields.shortCode.value && fields.shortCode.valid)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Short URL</DialogTitle>
          <DialogDescription>
            Enter a URL to create a shortened version. Optionally specify a
            custom short code.
          </DialogDescription>
        </DialogHeader>
        <form {...getFormProps(form, {})} action={action}>
          <div>{form.errors}</div>
          <div className="grid grid-cols-4 gap-x-4 py-4">
            <span
              id={fields.url.errorId}
              className="text-xs col-start-2 col-span-3 text-red-600 text-center"
            >
              {fields.url.errors}
            </span>
            <div className="grid col-span-4 grid-cols-4 items-center gap-4 mb-4">
              <Label htmlFor={fields.url.id} className="text-right">
                URL
              </Label>
              <Input
                {...getInputProps(fields.url, { type: "url" })}
                placeholder="https://example.polinetwork.org/path"
                className="col-span-3"
              />
            </div>
            <span
              id={fields.shortCode.errorId}
              className="text-xs col-start-2 col-span-3 text-red-600 text-center"
            >
              {fields.shortCode.errors?.join(", ")}
            </span>
            <div className="grid col-span-4 grid-cols-4 items-center gap-4 mb-4">
              <Label htmlFor={fields.shortCode.id} className="text-right">
                Short Code
              </Label>
              <Input
                {...getInputProps(fields.shortCode, { type: "text" })}
                placeholder="custom-code (optional)"
                className="col-span-3"
                title="Short code can only contain letters, numbers, hyphens and underscores (2-20 characters)"
              />
            </div>
            <div className="grid col-span-4 grid-cols-4 items-start gap-4 mb-4">
              <Label className="text-right pt-2">Tags</Label>
              <TagChipInput tags={tags} onChange={setTags} />
            </div>
            {tags.map((tag, i) => (
              <input key={tag} type="hidden" name={`tags[${i}]`} value={tag} />
            ))}
            <div className="col-span-4 text-sm text-muted-foreground">
              If you leave <i>Short Code</i> empty, a random one will be
              auto-generated upon submission.
            </div>
          </div>
          <p className="text-xs">Preview: </p>
          <div className="text-sm p-4 border rounded-md border-border mb-4 mt-1 flex flex-col gap-1 bg-muted/50 text-muted-foreground">
            <p className="font-mono mx-auto">
              https://{env.NEXT_PUBLIC_DOMAIN}/
              {isRandom ? (
                <RandomText generate={randomCode} />
              ) : (
                <span>{fields.shortCode.value}</span>
              )}
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
