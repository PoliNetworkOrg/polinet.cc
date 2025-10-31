# polinet.cc AI Coding Instructions

## Project Overview

polinet.cc is a specialized URL shortener for the polinetwork.org domain ecosystem. It uses Next.js 15 with App Router, PostgreSQL, and follows a contract-first API design pattern using ts-rest.

## Architecture Patterns

### Contract-First API Design
- All API endpoints are defined in `src/lib/contract.ts` using ts-rest
- The contract serves as the single source of truth for API schema, routes, and validation
- API handlers in `src/app/api/[...ts-rest]/route.ts` implement the contract using `createNextHandler`
- OpenAPI documentation is auto-generated from the contract at `/api/openapi.json`

### Database Patterns
- Uses PostgreSQL with raw SQL queries (no ORM)
- Connection pooling via `pg.Pool` singleton in `src/lib/db.ts`
- Database schema auto-initializes on startup
- All database types are Zod schemas exported from `src/lib/db.ts`
- Service layer in `src/lib/url-service.ts` handles all database operations

### URL Generation & Redirection
- Short codes are 8-character nanoids generated in `UrlService.createShortUrl()`
- Redirection happens via Next.js dynamic routes at `src/app/[shortCode]/page.tsx`
- Click tracking is fire-and-forget (`.catch(console.error)` pattern)

## Development Workflow

### Commands
```bash
pnpm dev          # Development server on port 6111 with Turbopack
pnpm lint         # Biome linting and formatting check
pnpm format       # Auto-format with Biome
```

### Code Style (Biome)
- 2-space indentation, semicolons as needed, ES5 trailing commas
- Imports are auto-organized on save
- shadcn/ui components use global CSS excluded from Biome formatting

### Frontend Patterns
- Uses shadcn/ui with "new-york" style and slate base color
- Client components for interactivity (Dashboard uses React hooks)
- Server components for data fetching (redirect pages)
- Sonner for toast notifications, standard error handling patterns

## Key Integration Points

### API Client Pattern
Frontend components call `/api/urls` endpoints directly (no API client wrapper). Standard fetch with JSON, error handling via toast notifications.

### Database Schema
```sql
-- Auto-created table with indexes
urls (id SERIAL, original_url TEXT, short_code VARCHAR(10) UNIQUE, 
      created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ, click_count INTEGER)
```

### Type Safety
- Zod schemas define all data shapes and validation
- Database results are typed via Zod parsing
- Contract ensures API request/response type safety

## Project-Specific Conventions

- Environment: `DATABASE_URL` for PostgreSQL connection
- Port: Always use 6111 for development
- Short codes: Always 8 characters, generated with nanoid
- Error responses: `{ error: string }` format
- File organization: `/lib` for business logic, `/components` for UI, `/app` for routes
- API base path: `/api` (configured in ts-rest handler)

## When Making Changes

1. **API changes**: Update contract first, then implementation
2. **Database changes**: Modify schema in `db.ts` initialization
3. **Validation changes**: Update Zod schemas in `validations.ts`
4. **New endpoints**: Add to contract, implement in API handler, update OpenAPI if needed
5. **Frontend**: Use existing shadcn/ui patterns, maintain client/server component separation