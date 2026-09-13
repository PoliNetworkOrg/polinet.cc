# polinet.cc - URL Shortener

A Next.js URL shortener application for polinetwork.org domains.

## Features

- 🔗 **URL Shortening**: Create short URLs for any polinetwork.org subdomain
- 📊 **Dashboard**: Web interface to manage all shortened URLs
- 🚀 **RESTful API**: Programmatic access for other services
- 📈 **Click Tracking**: Monitor usage of your shortened URLs
- 🗄️ **PostgreSQL**: Persistent storage with PostgreSQL database
- 🎨 **Vibe Coded**: Claude wrote this, if it's broken blame him
- 📦 **Typed Client**: the API contract is published as [`@polinetworkorg/polinet.cc`](https://www.npmjs.com/package/@polinetworkorg/polinet.cc)

### Why?

This thing is dead simple, and other services can integrate with it via API to create
a butload of shortened URLs. Very cool, very free, which makes it even cooler.

#### Yeah ok but why Next of all things???

No good reason really, but it works, the REST API is handled with `ts-rest`, UI
with `shadcn/ui`, allowing me to autogenerate both an `openapi.json` file and the
docs for it with `@scalar/api-reference-react`.

If I was to do it again I'd try `Hono` with SSG for the UI.

## Repository layout

This is a pnpm workspace:

- `/` — the Next.js app (UI, API routes, database access).
- `packages/contract` — [`@polinetworkorg/polinet.cc`](./packages/contract), the `ts-rest` contract
  and zod schemas, published to npm so other services can call the API with full type safety.

The app consumes the package through the workspace link, so the contract and the server that
implements it can never drift apart.

## Setup

### Prerequisites

- Node.js 24+ 
- PostgreSQL database
- pnpm package manager

### Installation

1. Clone the repository and install dependencies:
```bash
pnpm install
```

2. Edit `.env` and set your PostgreSQL connection string:
```env
DATABASE_URL=postgresql://username:password@host:port/database_name
```

3. Start the development server:
```bash
pnpm dev
```

The application will be available at `http://localhost:6111`.

## License

MIT
