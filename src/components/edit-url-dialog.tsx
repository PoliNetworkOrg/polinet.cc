"use client"

import { getFormProps, getInputProps, useForm } from "@conform-to/react"
import { getZodConstraint, parseWithZod } from "@conform-to/zod"
import { useActionState } from "react"
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
import { makeShortUrl } from "@/lib/utils"
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
