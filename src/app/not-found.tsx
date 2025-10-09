import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function NotFound() {
  return (
    <div className="container mx-auto p-6 min-h-screen flex items-center justify-center">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Short URL Not Found</CardTitle>
          <CardDescription>
            The short URL you're looking for doesn't exist or has been removed.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">This could happen if:</p>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• The URL was typed incorrectly</li>
            <li>• The short URL has been deleted</li>
            <li>• The URL has expired</li>
          </ul>
          <Button asChild variant="outline" className="w-full">
            <Link href="/admin">Go to Admin Dashboard</Link>
          </Button>
          <Button asChild className="w-full">
            <Link href="/">Go to polinetwork.org</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
