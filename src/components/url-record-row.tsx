import {
  ArrowRight,
  Copy,
  Diamond,
  Edit,
  Pointer,
  QrCode,
  Star,
  Trash2,
} from "lucide-react"
import type { UrlRecord } from "@/lib/schemas"
import { makeShortUrl,
copyToClipboard } from "@/lib/utils"
import { Button } from "./ui/button"
import { TableCell, TableRow } from "./ui/table"

export type UrlRecordRowProps = {
  url: UrlRecord
  onCopy: (url: UrlRecord) => void
  onDelete: (url: UrlRecord) => void
  onEdit: (url: UrlRecord) => void
  onQrCode: (url: UrlRecord) => void
}

export function MobileRow({
  url,
  onCopy,
  onDelete,
  onEdit,
  onQrCode,
}: UrlRecordRowProps) {
  const shortUrl = makeShortUrl(url)
  return (
    <div className="flex flex-col gap-1 border rounded-md py-2 px-4">
      <div className="flex justify-start gap-2 items-center">
        {url.is_custom ? (
          <Star className="h-4 w-4 fill-yellow-400 stroke-yellow-400" />
        ) : (
          <Diamond className="h-4 w-4 fill-gray-400 stroke-gray-400" />
        )}

        <a
          href={shortUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:underline font-mono"
        >
          {shortUrl}
        </a>
        <Button variant="ghost" size="icon" onClick={() => onCopy(url)}>
          <Copy />
        </Button>
      </div>
      <div className="flex justify-start gap-2 items-center">
        <ArrowRight className="text-blue-400" />
        <a
          href={url.original_url}
          className="text-blue-400 hover:underline font-mono truncate"
          title={url.original_url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {url.original_url}
        </a>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => copyToClipboard(url.original_url)}
        >
          <Copy />
        </Button>
      </div>
      <div className="flex justify-end gap-2 items-center py-1 flex-wrap">
        <Pointer className="h-3 w-3 text-muted-foreground" />
        <span className="text-sm">{url.click_count}</span>
        <div className="flex-1" />
        <span className="text-sm text-muted-foreground">
          {url.created_at.toLocaleString()}
        </span>
        <div className="flex justify-end items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => onQrCode(url)}>
            <QrCode />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onEdit(url)}>
            <Edit />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onDelete(url)}>
            <Trash2 className="stroke-destructive" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export function UrlRecordRow({ url, ...props }: UrlRecordRowProps) {
  const shortUrl = makeShortUrl(url)
  return (
    <TableRow key={url.id} className="max-sm:hidden">
      <TableCell>
        {url.is_custom ? (
          <Star className="h-4 w-4 fill-yellow-400 stroke-yellow-400" />
        ) : (
          <Diamond className="h-4 w-4 fill-gray-400 stroke-gray-400" />
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <a
            href={shortUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline font-mono"
          >
            {shortUrl}
          </a>
          <Button variant="ghost" size="icon" onClick={() => props.onCopy(url)}>
            <Copy />
          </Button>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <a
            href={url.original_url}
            className="text-blue-400 hover:underline font-mono truncate max-w-[20vw] xl:max-w-[500px]"
            title={url.original_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {url.original_url}
          </a>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => copyToClipboard(url.original_url)}
          >
            <Copy />
          </Button>
        </div>
      </TableCell>
      <TableCell>
        <span className="text-sm text-muted-foreground">
          {url.created_at.toLocaleString()}
        </span>
      </TableCell>
      <TableCell className="text-center">
        <span className="font-medium">{url.click_count}</span>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => props.onQrCode(url)}
          >
            <QrCode />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => props.onEdit(url)}>
            <Edit />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => props.onDelete(url)}
          >
            <Trash2 className="stroke-destructive" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}
