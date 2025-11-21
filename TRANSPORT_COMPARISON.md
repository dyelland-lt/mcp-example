# Transport Comparison: STDIO vs HTTP

## Quick Reference

| Feature | STDIO Transport | HTTP Transport |
|---------|----------------|----------------|
| **Command** | `pnpm start` | `pnpm start:http` |
| **Best For** | Claude Desktop, CLI tools | Web apps, OAuth flows |
| **OAuth Support** | Limited (external APIs only) | Full (server authentication) |
| **Port** | None (stdio pipes) | 3000 (configurable) |
| **Multiple Clients** | No | Yes |
| **CORS** | N/A | Yes (configurable) |
| **Health Check** | No | Yes (`/health`) |
| **Discovery** | Via config file | Via URL endpoint |

## When to Use STDIO

✅ **Use STDIO when:**
- Integrating with Claude Desktop
- Building command-line tools
- Local development and testing
- Single-client scenarios
- No OAuth server authentication needed

**Example**: Claude Desktop integration
```json
{
  "mcpServers": {
    "example": {
      "command": "node",
      "args": ["/path/to/build/index.js"]
    }
  }
}
```

## When to Use HTTP

✅ **Use HTTP when:**
- OAuth authentication is required
- Multiple clients need to connect
- Building web applications
- Need CORS support
- Want health monitoring
- Remote server deployment

**Example**: Web application integration
```typescript
const client = new Client(/* ... */);
const transport = new SSEClientTransport(
  new URL("https://mcp.example.com/sse")
);
await client.connect(transport);
```

## OAuth Considerations

### STDIO with OAuth

```
┌─────────────┐
│ MCP Client  │
│ (Claude)    │
└──────┬──────┘
       │ stdio
       ▼
┌─────────────┐     OAuth      ┌──────────────┐
│ MCP Server  │───────────────>│ External API │
│   (STDIO)   │                │  (GraphQL)   │
└─────────────┘                └──────────────┘
```

- OAuth tokens used for external API calls
- Server acts as OAuth client
- Not compliant with MCP Auth Spec (but works)

### HTTP with OAuth

```
┌─────────────┐
│ MCP Client  │
│  (Web App)  │
└──────┬──────┘
       │ HTTP/SSE + OAuth
       ▼
┌─────────────┐     OAuth      ┌──────────────┐
│ MCP Server  │───────────────>│ External API │
│   (HTTP)    │                │  (GraphQL)   │
└─────────────┘                └──────────────┘
```

- OAuth tokens for server authentication
- Full MCP Authorization Spec compliance
- Redirect URI handling
- Token refresh support

## Feature Comparison

### Tools (Both Transports)

Both transports support the same tools:
- ✅ `query` - GraphQL queries
- ✅ `oauth_configure` - OAuth configuration
- ✅ `oauth_initiate` - Start OAuth flow
- ✅ `oauth_complete` - Complete OAuth flow
- ✅ `oauth_status` - Check authentication status
- ✅ `oauth_logout` - Clear tokens

### Resources (Both Transports)

Both transports support the same resources:
- ✅ `note://welcome` - Welcome message
- ✅ `note://info` - Server information
- ✅ `note://{key}` - Dynamic notes

### HTTP-Only Features

HTTP transport adds:
- ✅ Health check endpoint (`/health`)
- ✅ CORS configuration
- ✅ Multiple concurrent clients
- ✅ Graceful shutdown handling
- ✅ Connection monitoring

## Performance

### STDIO
- **Latency**: Lower (direct process communication)
- **Throughput**: Higher (no HTTP overhead)
- **Connections**: Single client
- **Overhead**: Minimal

### HTTP
- **Latency**: Slightly higher (HTTP/network stack)
- **Throughput**: Good (HTTP/2 support possible)
- **Connections**: Multiple concurrent clients
- **Overhead**: Moderate (HTTP headers, SSE)

## Development Experience

### STDIO Development

```bash
# Start with inspector
pnpm dev

# Logs to stderr
console.error("Debug message");

# Test with Claude Desktop
# Update config, restart Claude
```

### HTTP Development

```bash
# Start server
pnpm dev:http

# Test with curl
curl http://localhost:3000/health

# Connect SSE
curl -N http://localhost:3000/sse

# View logs in terminal
# Hot reload with tsx
```

## Deployment

### STDIO Deployment

```bash
# Build
pnpm build

# Run
node build/index.js

# Or with environment
GRAPHQL_AUTH_TOKEN=xxx node build/index.js
```

**Typical deployments**:
- User's local machine (Claude Desktop)
- CLI tool distribution
- Docker container (for CLI usage)

### HTTP Deployment

```bash
# Build
pnpm build

# Run with environment
PORT=8080 HOST=0.0.0.0 node build/index-http.js

# Or with process manager
pm2 start build/index-http.js --name mcp-server
```

**Typical deployments**:
- Cloud platforms (AWS, GCP, Azure)
- Container orchestration (Kubernetes)
- Platform-as-a-Service (Heroku, Render)
- Behind reverse proxy (nginx, Caddy)

## Security

### STDIO Security

- ✅ Isolated process communication
- ✅ No network exposure
- ✅ OS-level permissions
- ⚠️ No transport encryption (local only)
- ⚠️ Limited authentication options

### HTTP Security

- ✅ TLS/HTTPS support
- ✅ CORS policies
- ✅ Rate limiting (add middleware)
- ✅ Authentication middleware
- ⚠️ Network exposure (use firewall)
- ⚠️ Requires proper configuration

## Migration Path

You can run both transports simultaneously:

```bash
# Terminal 1: STDIO for Claude Desktop
pnpm start

# Terminal 2: HTTP for web clients
PORT=3000 pnpm start:http
```

Or deploy separately:
- STDIO version for desktop users
- HTTP version for web applications
- Both use same core logic (`server.ts`)

## Recommendation

**For most users**: Start with **STDIO** transport
- Simpler setup
- Better for Claude Desktop
- Lower overhead

**Upgrade to HTTP when you need**:
- OAuth server authentication
- Web application integration
- Multiple concurrent clients
- Remote access
- Health monitoring

**Best of both**: Keep both options available
- Users choose based on needs
- Same codebase, different transports
- No feature loss either way
