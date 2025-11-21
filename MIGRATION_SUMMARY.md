# MCP Server HTTP Migration Summary

## Overview

Your MCP server has been successfully converted to support both STDIO and HTTP transports. The HTTP transport uses Server-Sent Events (SSE) which is required for full OAuth support according to the MCP Authorization Specification.

## What Changed

### New Files Created

1. **`src/server.ts`** - Shared server logic
   - Extracted all MCP server configuration and handlers
   - Used by both stdio and HTTP entry points
   - Eliminates code duplication

2. **`src/index-http.ts`** - HTTP server entry point
   - Express-based HTTP server
   - SSE transport for MCP communication
   - CORS support for cross-origin requests
   - Health check endpoint

3. **`HTTP_SERVER_GUIDE.md`** - Connection and usage guide
   - Detailed HTTP server documentation
   - Client connection examples
   - OAuth flow with HTTP transport
   - Security and troubleshooting

### Modified Files

1. **`src/index.ts`** - Now uses shared server logic
   - Simplified to just create transport and connect
   - Still uses STDIO transport for backward compatibility

2. **`package.json`** - New scripts and dependencies
   - Added `express`, `cors` dependencies
   - Added `@types/express`, `@types/cors` dev dependencies
   - New scripts: `start:http`, `dev:http`

3. **`README.md`** - Updated documentation
   - Transport options section
   - HTTP server usage instructions
   - Updated project structure

4. **`src/config.json`** - Added HTTP server config
   - New `rick_n_morty_http` configuration

## How to Use

### STDIO Transport (Original Behavior)

For Claude Desktop and other stdio-based MCP clients:

```bash
# Development
pnpm dev

# Production
pnpm start
```

**Config** (Claude Desktop):
```json
{
  "mcpServers": {
    "example": {
      "command": "node",
      "args": ["/path/to/mcp-example/build/index.js"]
    }
  }
}
```

### HTTP Transport (OAuth-Enabled)

For OAuth authentication and HTTP-based MCP clients:

```bash
# Development
pnpm dev:http

# Production
pnpm start:http

# Custom port
PORT=8080 pnpm start:http
```

**Endpoints**:
- SSE: `http://localhost:3000/sse`
- Messages: `http://localhost:3000/messages`
- Health: `http://localhost:3000/health`

## OAuth Support

### Why HTTP Transport?

The MCP Authorization Specification states:

> "OAuth authorization is designed for HTTP-based transports. Implementations using an STDIO transport SHOULD NOT follow this specification."

The HTTP server with SSE transport provides:
- ✅ Full OAuth 2.0 authorization code flow with PKCE
- ✅ Proper redirect URI handling
- ✅ Token refresh capabilities
- ✅ Protected Resource Metadata discovery (RFC 9728)
- ✅ Authorization Server Metadata discovery (RFC 8414)
- ✅ Client ID Metadata Documents support

### OAuth Flow with HTTP Server

1. **Start HTTP server**:
   ```bash
   pnpm start:http
   ```

2. **Connect MCP client** to `http://localhost:3000/sse`

3. **Configure OAuth**:
   ```javascript
   await client.callTool("oauth_configure", {
     clientId: "your_client_id",
     authorizationUrl: "https://auth.example.com/oauth/authorize",
     tokenUrl: "https://auth.example.com/oauth/token",
     redirectUri: "http://localhost:3000/callback",
     resource: "https://mcp.example.com"
   });
   ```

4. **Initiate OAuth**:
   ```javascript
   const result = await client.callTool("oauth_initiate", {});
   // Visit the authorization URL in browser
   ```

5. **Complete OAuth**:
   ```javascript
   await client.callTool("oauth_complete", {
     code: "AUTH_CODE",
     state: "STATE_VALUE"
   });
   ```

6. **Make authenticated requests** - OAuth token automatically included

## Architecture

```
┌─────────────────────────────────────────┐
│           src/server.ts                 │
│      (Shared Server Logic)              │
│  - Tool handlers                        │
│  - Resource handlers                    │
│  - OAuth tools                          │
│  - GraphQL client                       │
└─────────────┬───────────────────────────┘
              │
       ┌──────┴──────┐
       │             │
┌──────▼──────┐ ┌───▼────────┐
│ src/index.ts│ │src/index-  │
│  (STDIO)    │ │http.ts     │
│             │ │  (HTTP+SSE)│
└─────────────┘ └────────────┘
       │             │
   STDIO         HTTP/SSE
   Transport     Transport
       │             │
       ▼             ▼
   Claude        Web/HTTP
   Desktop       Clients
```

## Key Features

### Both Transports Support

- ✅ GraphQL queries (Rick and Morty API)
- ✅ Resource reading (notes)
- ✅ OAuth configuration
- ✅ OAuth status checking
- ✅ Token management

### HTTP Transport Additional Benefits

- ✅ Full OAuth redirect flow support
- ✅ Cross-origin requests (CORS)
- ✅ Health check endpoint
- ✅ Multiple concurrent clients
- ✅ Web browser compatibility

## Testing

### Test STDIO Server

```bash
pnpm dev
# Use with MCP Inspector or Claude Desktop
```

### Test HTTP Server

```bash
# Terminal 1: Start server
pnpm dev:http

# Terminal 2: Test health
curl http://localhost:3000/health

# Terminal 3: Connect to SSE
curl -N http://localhost:3000/sse
```

### Test with MCP Inspector

```bash
# STDIO version
pnpm dev

# HTTP version
# 1. Start HTTP server: pnpm dev:http
# 2. Configure inspector to connect to http://localhost:3000/sse
```

## Security Considerations

### Development

Current configuration is suitable for local development:
- CORS allows all origins (`origin: true`)
- No authentication on SSE endpoint
- HTTP (not HTTPS)

### Production Recommendations

1. **Use HTTPS**:
   ```bash
   # Use reverse proxy (nginx, Caddy, etc.)
   # Handle TLS termination at proxy level
   ```

2. **Restrict CORS**:
   ```typescript
   app.use(cors({
     origin: ['https://app.example.com'],
     credentials: true
   }));
   ```

3. **Add authentication**:
   ```typescript
   app.use('/sse', authMiddleware);
   ```

4. **Rate limiting**:
   ```typescript
   import rateLimit from 'express-rate-limit';
   app.use('/sse', rateLimit({ windowMs: 15*60*1000, max: 100 }));
   ```

5. **Environment variables**:
   ```bash
   export OAUTH_CLIENT_SECRET="secret"
   export ALLOWED_ORIGINS="https://app.example.com"
   ```

## Backward Compatibility

✅ **Complete backward compatibility maintained**

- Original STDIO server (`src/index.ts`) works exactly as before
- Claude Desktop configuration unchanged
- All existing tools and resources work identically
- No breaking changes to API

## Next Steps

1. **Test the HTTP server**:
   ```bash
   pnpm dev:http
   curl http://localhost:3000/health
   ```

2. **Try OAuth flow**: See `OAUTH_EXAMPLE.md`

3. **Connect a client**: See `HTTP_SERVER_GUIDE.md`

4. **Deploy to production**: Consider security recommendations above

## Troubleshooting

### Port Already in Use

```bash
# Change port
PORT=3001 pnpm dev:http
```

### Can't Connect to HTTP Server

```bash
# Check if running
curl http://localhost:3000/health

# Check logs
pnpm dev:http
```

### STDIO Still Works?

Yes! Both transports work independently:

```bash
# STDIO (original)
pnpm dev

# HTTP (new)
pnpm dev:http
```

You can even run both simultaneously on different ports.

## Resources

- [HTTP_SERVER_GUIDE.md](./HTTP_SERVER_GUIDE.md) - Detailed HTTP server guide
- [OAUTH_EXAMPLE.md](./OAUTH_EXAMPLE.md) - OAuth usage examples
- [README.md](./README.md) - General documentation
- [MCP Authorization Spec](https://modelcontextprotocol.io/specification/draft/authorization)
