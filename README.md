# Asura Manga API

A modern Deno-based manga/manhwa parser API for asuracomics.com with Deno KV storage.

## Features

- **Latest Deno 2.x support** - Built with the latest Deno version
- **Deno KV storage** - Fast, serverless-ready key-value database
- **Fresh framework** - Modern full-stack web framework for Deno
- **Manga parsing** - Automated parsing of asuracomics.com content
- **RESTful API** - Clean API endpoints for manga data

## Deployment

### Deno Deploy
This application is optimized for Deno Deploy. Simply:

1. Fork this repository
2. Connect to Deno Deploy
3. Deploy directly - no additional configuration needed

### Local Development
```bash
deno task start
```

### Build Database
To update the manga database:
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
- `GET /api/[slug]/chapter/[chapter]` - Get specific chapter images
- `GET /api/image` - Proxy images from asuracomics.com

## Environment Variables

- `APP_URL` - Base URL for the application (optional)
- `DENO_DEPLOYMENT_ID` - Set this for production deployment detection

## Tech Stack

- **Deno 2.x** - JavaScript/TypeScript runtime
- **Fresh 1.7.x** - Full-stack web framework
- **Deno KV** - Built-in key-value database
- **Preact** - Lightweight React alternative
- **Twind** - Tailwind-in-JS CSS framework 