"use client"

import { getFormProps, getInputProps, useForm } from "@conform-to/react"
import { getZodConstraint, parseWithZod } from "@conform-to/zod"
import { nanoid } from "nanoid"
import { useActionState, useCallback } from "react"
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
import { createUrl } from "@/lib/actions/forms"
import { createUrlSchema } from "@/lib/validations"
import { RandomText } from "./random-text"

interface CreateUrlDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
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
  const [form, fields] = useForm({
    lastResult,
    constraint: getZodConstraint(createUrlSchema),
    onValidate: ({ formData }) =>
      parseWithZod(formData, { schema: createUrlSchema }),
    onSubmit: () => {
      if (error) {
        console.error("Error creating URL:", error)
        toast.error(`Error creating URL: ${error}`)
      } else {
        toast.success("Short URL created successfully!")
      }
      onSuccess()
    },

    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
  })

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
            <div className="col-span-4 text-sm text-muted-foreground">
              If you leave <i>Short Code</i> empty, a random one will be
              auto-generated upon submission.
            </div>
          </div>
          <p className="text-xs">Preview: </p>
          <div className="text-sm p-4 border rounded-md border-border mb-4 mt-1 flex flex-col gap-1 bg-muted/50 text-muted-foreground">
            <p className="font-mono mx-auto">
              https://${env.NEXT_PUBLIC_DOMAIN}/
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
