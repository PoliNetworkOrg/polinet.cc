import { useState } from "react"
import type { PaginatedUrlsResponse } from "@/lib/schemas"
import { withPages } from "@/lib/utils"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "./ui/pagination"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select"

export function PaginationControls(
  props: {
    onPageChange: (page: number) => void
    onLimitChange?: (limit: number) => void
  } & PaginatedUrlsResponse["pagination"]
) {
  const [limit, setLimit] = useState(props.limit)

  const handleLimitChange = (value: string) => {
    const newLimit = parseInt(value, 10)
    setLimit(newLimit)
    if (props.onLimitChange) {
      props.onLimitChange(newLimit)
    }
  }
  console.log(props.page, props.totalPages)

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-[1_0_auto] items-center gap-4">
        <p className="text-sm text-muted-foreground">
          Showing {(props.page - 1) * limit + 1} to{" "}
          {Math.min(props.page * limit, props.total)} of {props.total} results
        </p>
      </div>
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              onClick={() =>
                props.page > 1 && props.onPageChange(props.page - 1)
              }
              className={
                props.page === 1
                  ? "pointer-events-none opacity-50"
                  : "cursor-pointer"
              }
            />
          </PaginationItem>

          {withPages(props.page, props.totalPages).map(({ page, ellipses }) => {
            return (
              <div key={page} className="flex">
                {ellipses && (
                  <PaginationItem>
                    <span className="px-4">...</span>
                  </PaginationItem>
                )}
                <PaginationItem>
                  <PaginationLink
                    onClick={() => props.onPageChange(page)}
                    isActive={page === props.page}
                    className="cursor-pointer"
                  >
                    {page}
                  </PaginationLink>
                </PaginationItem>
              </div>
            )
          })}

          <PaginationItem>
            <PaginationNext
              onClick={() => {
                if (props.page < props.totalPages) {
                  props.onPageChange(props.page + 1)
                }
              }}
              className={
                props.page < props.totalPages
                  ? "cursor-pointer"
                  : "pointer-events-none opacity-50"
              }
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
      <div className="flex flex-[1_0_auto] items-center gap-2">
        <span className="text-sm text-muted-foreground">Items per page:</span>
        <Select value={limit.toString()} onValueChange={handleLimitChange}>
          <SelectTrigger className="w-[70px] h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="5">5</SelectItem>
            <SelectItem value="10">10</SelectItem>
            <SelectItem value="20">20</SelectItem>
            <SelectItem value="50">50</SelectItem>
            <SelectItem value="100">100</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
