"use client"

import { getFormProps, getInputProps, useForm } from "@conform-to/react"
import { getZodConstraint, parseWithZod } from "@conform-to/zod"
import { X } from "lucide-react"
import { useActionState, useEffect, useState, useRef } from "react"
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
import { editUrl } from "@/lib/actions"
import type { UrlRecord } from "@/lib/schemas"
import { getTagColor, makeShortUrl } from "@/lib/utils"
import { editUrlSchema } from "@/lib/validations"

export type EditDialogState =
  | {
      open: false
    }
  | {
      open: true
      url: UrlRecord
    }

type EditUrlDialogProps = EditDialogState & {
  onClose: () => void
  onSuccess: () => void
}

export function EditUrlDialog({
  onClose,
  onSuccess,
  ...state
}: EditUrlDialogProps) {
  const [{ error, lastResult }, action, pending] = useActionState(editUrl, {
    error: null,
    lastResult: null,
  })
  const [form, fields] = useForm({
    lastResult,
    constraint: getZodConstraint(editUrlSchema),
    onValidate: ({ formData }) =>
      parseWithZod(formData, { schema: editUrlSchema }),
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
  })

  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState("")
  const [tagError, setTagError] = useState<string | null>(null)

  const urlId = state.open ? state.url.id : 0
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset tags only when the dialog opens or a different URL is loaded
  useEffect(() => {
    if (state.open) setTags(state.url.tags ?? [])
    setTagInput("")
    setTagError(null)
  }, [state.open, urlId])

  const addTag = () => {
    const trimmed = tagInput.trim().replace(/,+$/, "")
    if (!trimmed) return
    if (trimmed.length > 50) {
      setTagError("Tag must be at most 50 characters")
      return
    }
    if (tags.includes(trimmed)) {
      setTagError("Tag already added")
      return
    }
    setTags((prev) => [...prev, trimmed])
    setTagInput("")
    setTagError(null)
  }

  const removeTag = (tag: string) =>
    setTags((prev) => prev.filter((t) => t !== tag))
  const onSuccessRef = useRef(onSuccess)
  useEffect(() => {
    onSuccessRef.current = onSuccess
  })

  useEffect(() => {
    if (lastResult && form.status === "success") {
      toast.success("Short URL edited successfully!")
      onSuccessRef.current()
    } else if (lastResult && error) {
      console.error("Error editing URL:", error)
      toast.error(`Error editing URL: ${error}`)
    }
  }, [lastResult, error, form.status])

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      {state.open && (
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Short URL</DialogTitle>
            <DialogDescription>
              Update the destination URL for {makeShortUrl(state.url)}.
            </DialogDescription>
          </DialogHeader>
          <form {...getFormProps(form, {})} action={action}>
            <div className="grid grid-cols-4 gap-x-4 py-4">
              <span
                id={fields.shortCode.errorId}
                className="text-xs col-start-2 col-span-3 text-red-600 text-center"
              >
                {fields.shortCode.errors?.join(", ")}
              </span>
              <div className="grid grid-cols-4 col-span-4 items-center gap-4 mb-4">
                <Label htmlFor={fields.shortCode.id} className="text-right">
                  Short Code
                </Label>
                <Input
                  {...getInputProps(fields.shortCode, { type: "text" })}
                  value={state.url.short_code}
                  className="col-span-3"
                  tabIndex={-1}
                  aria-disabled
                  aria-readonly
                  readOnly
                />
              </div>
              <span
                id={fields.url.errorId}
                className="text-xs col-start-2 col-span-3 text-red-600 text-center"
              >
                {fields.url.errors?.join(", ")}
              </span>
              <div className="grid grid-cols-4 col-span-4 items-center gap-4">
                <Label htmlFor={fields.url.id} className="text-right">
                  URL
                </Label>
                <Input
                  {...getInputProps(fields.url, { type: "url" })}
                  placeholder="https://example.polinetwork.org/path"
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 col-span-4 items-start gap-4 mt-4">
                <Label className="text-right pt-2">Tags</Label>
                <div className="col-span-3 space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={tagInput}
                      onChange={(e) => {
                        setTagInput(e.target.value)
                        setTagError(null)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === ",") {
                          e.preventDefault()
                          addTag()
                        }
                      }}
                      placeholder="e.g. events, forms…"
                      className="flex-1"
                      maxLength={51}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addTag}
                    >
                      Add
                    </Button>
                  </div>
                  {tagError && (
                    <p className="text-xs text-red-600">{tagError}</p>
                  )}
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
                              onClick={() => removeTag(tag)}
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
                {tags.map((tag, i) => (
                  <input
                    key={tag}
                    type="hidden"
                    name={`tags[${i}]`}
                    value={tag}
                  />
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onClose()}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending || !form.valid}>
                {pending ? "Updating..." : "Update"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      )}
    </Dialog>
  )
}
