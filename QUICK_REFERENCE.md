# Quick Reference Card

## 🚀 Getting Started

```bash
pnpm install && pnpm build
```

## 🎯 Running the Server

### STDIO Transport (Claude Desktop)
```bash
pnpm start          # Production
pnpm dev            # Development with inspector
```

### HTTP Transport (OAuth Enabled)
```bash
pnpm start:http     # Production
pnpm dev:http       # Development with hot reload
PORT=8080 pnpm start:http   # Custom port
```

## 📡 HTTP Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/sse` | GET | MCP connection (Server-Sent Events) |
| `/messages` | POST | Client-to-server messages |
| `/health` | GET | Health check |

**Default URL**: `http://localhost:3000`

## 🔧 Available Tools

### GraphQL Queries
- `query` - Query Rick and Morty API
  - Types: `character`, `characters`, `episode`, `episodes`, `location`, `locations`
  - With filters, pagination, and batch queries

### OAuth Management
- `oauth_configure` - Set up OAuth credentials
- `oauth_initiate` - Start OAuth flow (returns auth URL)
- `oauth_complete` - Finish OAuth (exchange code for tokens)
- `oauth_status` - Check authentication status
- `oauth_logout` - Clear stored tokens

## 📚 Resources

- `note://welcome` - Welcome message
- `note://info` - Server information
- `note://{key}` - Dynamic notes

## 🔐 OAuth Flow (HTTP Server Only)

```javascript
// 1. Configure
await client.callTool("oauth_configure", {
  clientId: "your_id",
  authorizationUrl: "https://auth.example.com/oauth/authorize",
  tokenUrl: "https://auth.example.com/oauth/token",
  redirectUri: "http://localhost:3000/callback",
  resource: "https://mcp.example.com"
});

// 2. Initiate (returns auth URL)
const { authUrl } = await client.callTool("oauth_initiate", {});
// User visits authUrl in browser

// 3. Complete (after redirect)
await client.callTool("oauth_complete", {
  code: "AUTH_CODE",
  state: "STATE"
});

// 4. Authenticated! All requests now include OAuth token
```

## 🧪 Testing

### Test STDIO
```bash
pnpm dev
# Use MCP Inspector at http://localhost:5173
```

### Test HTTP Server
```bash
# Start server
pnpm dev:http

# Test health
curl http://localhost:3000/health

# Test SSE connection
curl -N http://localhost:3000/sse
```

## 📝 Configuration Files

### Claude Desktop Config
**Location**: `~/Library/Application Support/Claude/claude_desktop_config.json`

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

### Inspector Config
**Location**: `src/config.json`

```json
{
  "mcpServers": {
    "rick_n_morty": {
      "command": "tsx",
      "args": ["src/index.ts"]
    }
  }
}
```

## 🌍 Environment Variables

```bash
# GraphQL endpoint (optional)
export GRAPHQL_ENDPOINT="https://api.example.com/graphql"

# Static auth token (optional, OAuth preferred)
export GRAPHQL_AUTH_TOKEN="your_token"

# HTTP server configuration
export PORT=3000
export HOST=localhost
```

## 📖 Documentation

| Document | Purpose |
|----------|---------|
| `README.md` | Main documentation |
| `MIGRATION_SUMMARY.md` | HTTP conversion overview |
| `HTTP_SERVER_GUIDE.md` | HTTP server details |
| `OAUTH_EXAMPLE.md` | OAuth examples |
| `TRANSPORT_COMPARISON.md` | STDIO vs HTTP |
| `MCP_COMPLIANCE.md` | Spec compliance details |

## 🔍 Troubleshooting

### Port in use
```bash
# Change port
PORT=3001 pnpm start:http
```

### OAuth not working
```bash
# Check configuration
# Use oauth_status tool
# Ensure HTTP transport (not STDIO)
```

### Build errors
```bash
# Clean and rebuild
rm -rf build
pnpm build
```

### Connection issues
```bash
# Check server is running
curl http://localhost:3000/health

# View server logs
pnpm dev:http
```

## 🏗️ Project Structure

```
mcp-example/
├── src/
│   ├── index.ts           # STDIO entry point
│   ├── index-http.ts      # HTTP entry point
│   ├── server.ts          # Shared server logic
│   ├── oauth.ts           # OAuth implementation
│   ├── token-manager.ts   # Token management
│   └── config.json        # Inspector config
├── build/                 # Compiled output
└── *.md                   # Documentation
```

## 🔗 Useful Links

- [MCP Docs](https://modelcontextprotocol.io/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCP Authorization Spec](https://modelcontextprotocol.io/specification/draft/authorization)
- [Rick and Morty API](https://rickandmortyapi.com/graphql)

## 💡 Tips

- Use HTTP transport for OAuth support
- Use STDIO transport for Claude Desktop
- Both transports can run simultaneously
- All tools/resources work on both transports
- Check `/health` endpoint to verify HTTP server
- Use MCP Inspector for development and testing

---

**Quick Start**: `pnpm install && pnpm build && pnpm start:http`

**Need Help?** See documentation files or check server logs.
