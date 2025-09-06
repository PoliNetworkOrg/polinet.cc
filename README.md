# TMSU.CC - URL Shortener

A Next.js URL shortener application for tommasomorganti.com domains.

## Features

- 🔗 **URL Shortening**: Create short URLs for any tommasomorganti.com subdomain
- 📊 **Dashboard**: Web interface to manage all shortened URLs
- 🚀 **RESTful API**: Programmatic access for other services
- 📈 **Click Tracking**: Monitor usage of your shortened URLs
- 🗄️ **PostgreSQL**: Persistent storage with PostgreSQL database
- 🎨 **Vibe Coded**: Claude wrote this, if it's broken blame him

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

2. Set up your environment variables:
```bash
cp .env.example .env
```

Edit `.env` and set your PostgreSQL connection string:
```env
DATABASE_URL=postgresql://username:password@host:port/database_name
```

3. Start the development server:
```bash
pnpm dev
```

The application will be available at `http://localhost:6111`.

## Usage

### Dashboard

Visit the root URL to access the web dashboard where you can:
- Create new shortened URLs
- View all existing URLs and their statistics
- Edit existing URLs
- Delete URLs
- Copy short URLs to clipboard

### API Endpoints

#### Create a short URL
```bash
POST /api/urls
Content-Type: application/json

{
  "url": "https://blog.tommasomorganti.com/some-article"
}
```

Response:
```json
{
  "id": "1",
  "original_url": "https://blog.tommasomorganti.com/some-article",
  "short_code": "abc12345",
  "shortUrl": "https://tmsu.cc/abc12345",
  "created_at": "2024-01-01T12:00:00.000Z",
  "click_count": 0
}
```

#### Get all URLs
```bash
GET /api/urls
```

#### Get specific URL
```bash
GET /api/urls/{shortCode}
```

#### Update a URL
```bash
PUT /api/urls/{shortCode}
Content-Type: application/json

{
  "url": "https://new.tommasomorganti.com/updated-path"
}
```

#### Delete a URL
```bash
DELETE /api/urls/{shortCode}
```

### URL Redirection

Short URLs automatically redirect to their original destinations:
```
https://tmsu.cc/{shortCode} → https://original.tommasomorganti.com/path
```

## Domain Restrictions

- **Source domains**: Only URLs from `*.tommasomorganti.com` or `tommasomorganti.com` are allowed
- **Short URLs**: All shortened URLs use the `tmsu.cc` domain

## Database Schema

The application automatically creates the required database table:

```sql
CREATE TABLE urls (
  id SERIAL PRIMARY KEY,
  original_url TEXT NOT NULL,
  short_code VARCHAR(10) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  click_count INTEGER DEFAULT 0
);
```

## Technology Stack

- **Framework**: Next.js 15 with App Router
- **UI**: shadcn/ui components with Tailwind CSS
- **Database**: PostgreSQL with pg driver
- **Validation**: Zod
- **ID Generation**: nanoid
- **Notifications**: Sonner (toast notifications)

## Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Lint code
pnpm lint

# Format code
pnpm format
```

## License

MIT
