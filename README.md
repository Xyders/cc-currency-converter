# Hello World API

A simple Hello World API built with TypeScript and Cloudflare Workers.

## Overview

This project provides a basic HTTP API with three GET endpoints:
- `GET /` - Hello World greeting
- `GET /hello` - Hello from the API
- `GET /health` - Health check endpoint

All endpoints return JSON responses with appropriate HTTP status codes.

## Prerequisites

- Node.js 18 or later
- npm or yarn
- Cloudflare account (optional, for deployment)

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Run TypeScript type checking:

   ```bash
   npm run typecheck
   ```

## Development

Start the local development server:

```bash
npm run dev
```

The server will start at `http://localhost:8787`.

## API Endpoints

### `GET /`

Returns a Hello World message with timestamp.

**Response:**
```json
{
  "message": "Hello World!",
  "timestamp": "2026-02-22T12:00:00.000Z",
  "path": "/",
  "method": "GET"
}
```

### `GET /hello`

Returns a greeting from the API.

**Response:**
```json
{
  "message": "Hello from the API!",
  "endpoint": "/hello",
  "timestamp": "2026-02-22T12:00:00.000Z"
}
```

### `GET /health`

Health check endpoint.

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2026-02-22T12:00:00.000Z",
  "service": "hello-world-api"
}
```

### Unknown Routes

Returns a 404 Not Found error.

**Response:**
```json
{
  "error": "Not Found",
  "message": "Route not found",
  "path": "/unknown"
}
```

## Deployment

Deploy to Cloudflare Workers:

```bash
npm run deploy
```

You'll need to have Wrangler configured with your Cloudflare account credentials.

## Project Structure

```
.
├── src/
│   └── index.ts          # Main worker logic
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── wrangler.toml         # Cloudflare Workers configuration
└── README.md             # This file
```

## License

ISC