# Asura Manga API

A modern Deno-based manga/manhwa parser API for asuracomics.com with Deno KV storage and automated updates.

## Features

- **Latest Deno 2.x support** - Built with the latest Deno version
- **Deno KV storage** - Fast, serverless-ready key-value database
- **Fresh framework** - Modern full-stack web framework for Deno
- **Automated cron jobs** - Scheduled database updates every 6 hours
- **OpenAPI documentation** - Interactive API documentation with Swagger UI
- **Manga parsing** - Automated parsing of asuracomics.com content with Next.js compatibility
- **RESTful API** - Clean API endpoints for manga data
- **Real-time status** - API status endpoint with last update information

## Deployment

### Deno Deploy
This application is optimized for Deno Deploy with built-in cron support:

1. Fork this repository
2. Connect to Deno Deploy
3. Deploy directly - cron jobs are automatically registered
4. Set environment variable `CRON_SECRET` for additional security (optional)

### Local Development
```bash
deno task start
```

### Manual Database Build
To manually update the manga database:
```bash
deno task build-database
```

### Test KV Functionality
```bash
deno task test-kv
```

## API Endpoints

- `GET /api` - List all manga with pagination, search, and filtering
- `GET /api/[slug]` - Get specific manga details
- `GET /api/[slug]?includeChapters=true` - Get manga with chapters included
- `GET /api/[slug]/chapter/[chapter]` - Get specific chapter with page images
- `GET /api/status` - Get API status and last update information
- `GET /api/docs` - OpenAPI JSON specification
- `GET /api/docs/swagger` - Interactive Swagger UI documentation

## Automated Updates

The API automatically updates its database every 6 hours using Deno Deploy's cron functionality:
- **Database updates**: Every 6 hours at :00 minutes (0 */6 * * *)
- **Database cleanup**: Every Sunday at 2:00 AM UTC (0 2 * * SUN)

## Environment Variables

- `APP_URL` - Base URL for the application (optional)
- `DENO_DEPLOYMENT_ID` - Set this for production deployment detection
- `CRON_SECRET` - Secret for cron job authentication (optional)

## Tech Stack

- **Deno 2.x** - JavaScript/TypeScript runtime
- **Fresh 1.7.x** - Full-stack web framework
- **Deno KV** - Built-in key-value database
- **Preact** - Lightweight React alternative
- **Twind** - Tailwind-in-JS CSS framework 