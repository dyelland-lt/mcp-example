# HTTP Server Connection Guide

## Overview

The HTTP server uses Server-Sent Events (SSE) for MCP communication, which is required for proper OAuth support according to the MCP Authorization Specification.

## Starting the Server

```bash
# Development mode (with hot reload)
pnpm dev:http

# Production mode
pnpm start:http

# Custom host and port
PORT=8080 HOST=0.0.0.0 pnpm start:http
```

Default URL: `http://localhost:3000`

## Endpoints

### SSE Connection Endpoint
- **URL**: `GET /sse`
- **Description**: Establishes a Server-Sent Events connection for MCP communication
- **Headers**:
  - `Content-Type: text/event-stream`
  - `Cache-Control: no-cache`
  - `Connection: keep-alive`

### Message Endpoint
- **URL**: `POST /messages`
- **Description**: Receives messages from MCP clients
- **Content-Type**: `application/json`

### Health Check
- **URL**: `GET /health`
- **Description**: Returns server health status
- **Response**: `{ "status": "healthy", "timestamp": "..." }`

## Connecting with MCP Clients

### JavaScript/TypeScript Client Example

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

const transport = new SSEClientTransport(
  new URL("http://localhost:3000/sse")
);

const client = new Client(
  {
    name: "my-client",
    version: "1.0.0"
  },
  {
    capabilities: {}
  }
);

await client.connect(transport);

// Now you can use the client to call tools, read resources, etc.
const tools = await client.listTools();
console.log("Available tools:", tools);
```

### Testing with curl

```bash
# Test health endpoint
curl http://localhost:3000/health

# Connect to SSE endpoint (will keep connection open)
curl -N http://localhost:3000/sse
```

### Testing with EventSource (Browser)

```javascript
const eventSource = new EventSource('http://localhost:3000/sse');

eventSource.onmessage = (event) => {
  console.log('Received:', event.data);
};

eventSource.onerror = (error) => {
  console.error('SSE Error:', error);
};
```

## OAuth Flow with HTTP Transport

With the HTTP server running, you can use the full OAuth flow:

1. **Configure OAuth**:
```javascript
await client.callTool("oauth_configure", {
  clientId: "your_client_id",
  authorizationUrl: "https://auth.example.com/oauth/authorize",
  tokenUrl: "https://auth.example.com/oauth/token",
  redirectUri: "http://localhost:3000/callback",
  resource: "https://mcp.example.com"
});
```

2. **Initiate OAuth**:
```javascript
const result = await client.callTool("oauth_initiate", {});
// Visit the returned authorization URL in a browser
```

3. **Complete OAuth** (after redirect):
```javascript
await client.callTool("oauth_complete", {
  code: "AUTH_CODE_FROM_REDIRECT",
  state: "STATE_FROM_INITIATE"
});
```

4. **Make authenticated requests**:
```javascript
// All subsequent requests will use the OAuth token
const data = await client.callTool("query", {
  queryType: "characters",
  filters: { name: "Rick" }
});
```

## CORS Configuration

The server is configured to accept cross-origin requests with credentials:

```typescript
app.use(cors({
  origin: true,
  credentials: true
}));
```

For production, you should restrict the `origin` to specific domains:

```typescript
app.use(cors({
  origin: ['https://app.example.com', 'https://admin.example.com'],
  credentials: true
}));
```

## Security Considerations

### For Production Deployments:

1. **Use HTTPS**: Always use HTTPS in production
   ```bash
   # Example with reverse proxy (nginx, Caddy, etc.)
   # Let the proxy handle TLS termination
   ```

2. **Restrict CORS origins**: Don't use `origin: true` in production

3. **Set proper redirect URIs**: Use HTTPS for OAuth redirect URIs

4. **Environment variables**: Store sensitive configuration in environment variables
   ```bash
   export OAUTH_CLIENT_SECRET="your_secret"
   export GRAPHQL_AUTH_TOKEN="your_token"
   ```

5. **Rate limiting**: Consider adding rate limiting middleware

6. **Authentication**: For production, add authentication to the SSE endpoint

## Troubleshooting

### Connection Issues

**Problem**: Can't connect to SSE endpoint
```bash
# Check if server is running
curl http://localhost:3000/health

# Check if port is in use
lsof -i :3000
```

**Problem**: CORS errors in browser
- Make sure the server's CORS configuration includes your origin
- Check browser console for specific CORS error messages

### OAuth Issues

**Problem**: OAuth redirect fails
- Ensure `redirectUri` in configuration matches your OAuth app settings
- Check that the redirect URI uses the same protocol (http/https)

**Problem**: Token refresh fails
- Check token expiration with `oauth_status` tool
- Re-authenticate with `oauth_initiate` and `oauth_complete`

## Monitoring

The server logs connections and errors to stderr:

```bash
# View logs in development
pnpm dev:http

# In production, redirect logs
pnpm start:http 2> server.log
```

Example log output:
```
MCP HTTP Server running on http://localhost:3000
SSE endpoint: http://localhost:3000/sse
Health check: http://localhost:3000/health

New SSE connection established
MCP server connected via SSE
SSE connection closed
```

## Next Steps

- See [OAUTH_EXAMPLE.md](./OAUTH_EXAMPLE.md) for detailed OAuth usage
- See [README.md](./README.md) for general server documentation
- Check [MCP Authorization Specification](https://modelcontextprotocol.io/specification/draft/authorization) for OAuth requirements
