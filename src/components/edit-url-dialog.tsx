"use client"

import { getFormProps, getInputProps, useForm } from "@conform-to/react"
import { getZodConstraint, parseWithZod } from "@conform-to/zod"
import { X } from "lucide-react"
import { useActionState, useState } from "react"
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
import { Badge } from "./ui/badge"

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

function EditUrlForm({
  url,
  onClose,
  onSuccess,
}: {
  url: UrlRecord
  onClose: () => void
  onSuccess: () => void
}) {
  const [{ error, lastResult }, action, pending] = useActionState(editUrl, {
    error: null,
    lastResult: null,
  })
  const [aliases, setAliases] = useState<string[]>(url.aliases)
  const [aliasInput, setAliasInput] = useState("")
  const [aliasError, setAliasError] = useState<string | null>(null)

  const [tags, setTags] = useState<string[]>(url.tags ?? [])
  const [tagInput, setTagInput] = useState("")
  const [tagError, setTagError] = useState<string | null>(null)

  const [form, fields] = useForm({
    lastResult,
    constraint: getZodConstraint(editUrlSchema),
    defaultValue: {
      shortCode: url.short_code,
      url: url.original_url,
    },
    onValidate: ({ formData }) =>
      parseWithZod(formData, { schema: editUrlSchema }),
    onSubmit: () => {
      if (error) {
        console.error("Error editing URL:", error)
        toast.error(`Error editing URL: ${error}`)
      } else {
        toast.success("Short URL edited successfully!")
      }
      onSuccess()
    },
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
  })

  const addAlias = () => {
    const trimmed = aliasInput.trim()
    if (!trimmed) return
    if (!/^[a-zA-Z0-9_-]{2,25}$/.test(trimmed)) {
      setAliasError("2-25 chars: letters, numbers, hyphens, underscores")
      return
    }
    if (aliases.includes(trimmed)) {
      setAliasError("Alias already added")
      return
    }
    setAliases((prev) => [...prev, trimmed])
    setAliasInput("")
    setAliasError(null)
  }
  const removeAlias = (alias: string) =>
    setAliases((prev) => prev.filter((a) => a !== alias))

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

  return (
    <form {...getFormProps(form, {})} action={action}>
      <input type="hidden" name="currentShortCode" value={url.short_code} />
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
            className="col-span-3"
            title="Short code can only contain letters, numbers, hyphens and underscores (2-25 characters)"
          />
        </div>
        <span
          id={fields.url.errorId}
          className="text-xs col-start-2 col-span-3 text-red-600 text-center"
        >
          {fields.url.errors?.join(", ")}
        </span>
        <div className="grid grid-cols-4 col-span-4 items-center gap-4 mb-4">
          <Label htmlFor={fields.url.id} className="text-right">
            URL
          </Label>
          <Input
            {...getInputProps(fields.url, { type: "url" })}
            placeholder="https://example.polinetwork.org/path"
            className="col-span-3"
          />
        </div>
        <div className="grid grid-cols-4 col-span-4 items-start gap-4 mb-4">
          <Label className="text-right pt-2">Aliases</Label>
          <div className="col-span-3 space-y-2">
            <div className="flex gap-2">
              <Input
                value={aliasInput}
                onChange={(e) => {
                  setAliasInput(e.target.value)
                  setAliasError(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    addAlias()
                  }
                }}
                placeholder="Add alias short code…"
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addAlias}
              >
                Add
              </Button>
            </div>
            {aliasError && <p className="text-xs text-red-600">{aliasError}</p>}
            {aliases.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {aliases.map((alias) => (
                  <Badge key={alias} variant="secondary" className="gap-1">
                    /{alias}
                    <button
                      type="button"
                      onClick={() => removeAlias(alias)}
                      className="hover:opacity-70"
                      aria-label={`Remove alias ${alias}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
          {aliases.map((alias, i) => (
            <input
              key={alias}
              type="hidden"
              name={`aliases[${i}]`}
              value={alias}
            />
          ))}
        </div>
        <div className="grid grid-cols-4 col-span-4 items-start gap-4">
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
            {tagError && <p className="text-xs text-red-600">{tagError}</p>}
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
            <input key={tag} type="hidden" name={`tags[${i}]`} value={tag} />
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
  )
}

export function EditUrlDialog({
  onClose,
  onSuccess,
  ...state
}: EditUrlDialogProps) {
  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      {state.open && (
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Short URL</DialogTitle>
            <DialogDescription>
              Update the destination, short code or aliases for{" "}
              {makeShortUrl(state.url)}.
            </DialogDescription>
          </DialogHeader>
          {/* Keyed on the URL id so the form fully resets when switching URLs */}
          <EditUrlForm
            key={state.url.id}
            url={state.url}
            onClose={onClose}
            onSuccess={onSuccess}
          />
        </DialogContent>
      )}
    </Dialog>
  )
}
