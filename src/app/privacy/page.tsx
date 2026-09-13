import type { Metadata } from "next"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { env } from "@/env"

export const metadata: Metadata = {
  title: "Privacy — Analytics",
  description:
    "How this URL shortener collects minimal, anonymous, aggregated click analytics.",
}

// TODO(PoliNetwork): confirm the contact address used for privacy inquiries.
const CONTACT_EMAIL = "info@polinetwork.org"

function Item({ children }: { children: React.ReactNode }) {
  return <li className="text-sm text-muted-foreground">{children}</li>
}

export default function PrivacyPage() {
  return (
    <div className="container mx-auto max-w-3xl p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Privacy & Analytics</h1>
        <p className="text-muted-foreground">
          {env.NEXT_PUBLIC_DOMAIN} collects the minimum necessary to give link
          owners basic, anonymous click statistics. This page explains exactly
          what is and isn&apos;t collected.
        </p>
        <p className="text-sm text-muted-foreground">
          Data controller: <strong>PoliNetwork</strong> — contact{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="underline">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>What we collect</CardTitle>
          <CardDescription>
            Almost everything kept is aggregated statistics; the only exception
            is a short-lived deduplication hash described below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 list-disc pl-5">
            <Item>Total click counts per link.</Item>
            <Item>
              Clicks grouped into time buckets (by hour, day and month). Only
              the bucket is stored — never a precise per-click timestamp.
            </Item>
            <Item>
              Approximate <strong>country-level</strong> click counts. When the
              country can&apos;t be determined it is recorded as{" "}
              <strong>&quot;Unknown&quot;</strong>.
            </Item>
            <Item>
              An <strong>estimated</strong> number of unique clicks per day (see
              below).
            </Item>
            <Item>
              A short-lived, link-scoped daily{" "}
              <strong>deduplication hash</strong> — the only per-visitor value
              stored, and only to avoid counting the same person twice in one
              day. It is deleted within roughly 24–48 hours (see below).
            </Item>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What we do not do</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 list-disc pl-5">
            <Item>We do not use cookies.</Item>
            <Item>
              We do not use localStorage or sessionStorage for tracking.
            </Item>
            <Item>We do not fingerprint your browser or device.</Item>
            <Item>We do not build user profiles.</Item>
            <Item>
              We do not track you across different days or different links.
            </Item>
            <Item>
              We do not use any third-party analytics or tracking scripts.
            </Item>
            <Item>
              We do not store your raw IP address or your raw User-Agent string.
            </Item>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How unique clicks are estimated</CardTitle>
          <CardDescription>
            Without cookies, and without any direct identifiers or profiles.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            When you open a short link, your IP address and User-Agent are used
            only for a brief moment, in memory, to (1) look up an approximate
            country and (2) compute a one-way hash. Both values are then
            immediately discarded — they are never written to our database, logs
            or error reports.
          </p>
          <p>
            The hash is produced with HMAC-SHA256 using a secret key, and it
            includes the current date. Because the date is part of the input,
            the hash <strong>changes every day</strong>: the same visitor
            produces a different, unrelated hash tomorrow. This lets us avoid
            double-counting a visitor within a single day, while making it
            impossible to follow anyone from one day to the next. The hash is
            also scoped to a single link, so it can&apos;t be used to correlate
            activity across links.
          </p>
          <p>
            These short-lived hashes are the only per-visitor value stored, and
            they are automatically deleted shortly after the day they belong to
            (within roughly 24–48 hours). Only the aggregate counts survive.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Geolocation</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Country information is approximate and derived at the network edge.
            We only ever learn a country — never a city, region, precise
            location, ISP or network operator. If geolocation is unavailable the
            country is recorded as &quot;Unknown&quot;.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hosting</CardTitle>
          <CardDescription>
            PoliNetwork should confirm and complete this section with its actual
            hosting/infrastructure providers before relying on this page as a
            complete legal disclosure.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            The service (application and database) is hosted on infrastructure
            operated by or on behalf of PoliNetwork. Any hosting, DNS, or
            content-delivery provider involved may transiently process technical
            connection data (such as your IP address) to deliver the site,
            acting as a data processor on our behalf.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Legal basis & retention</CardTitle>
          <CardDescription>
            Under the EU GDPR and, for Italian users, Legislative Decree
            196/2003 as amended.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Almost everything retained here is anonymous, aggregated statistics
            that do not identify anyone. The single exception is the short-lived
            daily hash described above, which may qualify as{" "}
            <strong>pseudonymised personal data</strong> for the ~24–48 hours it
            exists. The legal basis for this minimal processing is our{" "}
            <strong>legitimate interest</strong> (Art. 6(1)(f) GDPR) in
            understanding basic, non-identifying traffic to our own links, using
            the most privacy-protective method we could implement — no cookies,
            no profiling, no cross-day or cross-site tracking.
          </p>
          <p>
            <strong>Retention:</strong> aggregate counts (by time bucket and
            country) are kept for as long as the link exists; the daily
            deduplication hashes are deleted automatically within roughly 24–48
            hours.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your rights & contact</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            We store no cookies, no direct identifiers and no raw IP or
            User-Agent; the only per-visitor value we keep is the short-lived
            daily hash above, which we cannot reverse to identify a person.
            Where applicable law grants you rights of access, rectification,
            erasure, restriction or objection to processing, you can exercise
            them by writing to{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="underline">
              {CONTACT_EMAIL}
            </a>
            . Note that, as we keep only anonymous aggregates and short-lived
            hashes we cannot reverse, we may be unable to locate data relating
            to a specific person.
          </p>
          <p>
            If you are in the EU you also have the right to lodge a complaint
            with your supervisory authority — in Italy, the{" "}
            <a
              href="https://www.garanteprivacy.it"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Garante per la protezione dei dati personali
            </a>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
