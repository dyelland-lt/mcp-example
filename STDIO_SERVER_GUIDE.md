# Stdio Server Guide

## Overview

This project now includes **two** MCP server implementations:

1. **Stdio Server** (`stdio-server.ts`) - Uses standard input/output for communication
2. **HTTP Server** (`index.ts`) - Uses HTTP with streamable transport for communication

Both servers use the same core MCP logic from `server.ts` but differ in their transport layer.

## When to Use Each Transport

### Stdio Transport

**Use when:**
- Building local MCP servers for desktop applications
- Working with Claude Desktop or similar local clients
- You want the simplest setup with no network configuration
- Running servers as subprocesses that communicate via pipes

**Advantages:**
- Simple setup - no ports or network configuration
- Direct subprocess communication
- Lower latency for local operations
- No CORS or network security concerns

**Limitations:**
- Only works for local communication
- Cannot be accessed over a network
- OAuth flows are more complex (requires external browser)

### HTTP Transport

**Use when:**
- Need OAuth authentication flows
- Building web-based or remote MCP servers
- Multiple clients need to connect to the same server
- Want to monitor traffic with standard HTTP tools

**Advantages:**
- Full OAuth support with redirect flows
- Can be accessed remotely
- Standard HTTP debugging tools work
- Supports multiple concurrent connections
- Built-in mock OAuth server for testing

**Limitations:**
- Requires port configuration
- More complex setup with Express
- CORS considerations for web clients
- Network security considerations

## Running the Servers

### Stdio Server

```bash
# Build the project
pnpm build

# Run the stdio server
pnpm start:stdio

# Test with MCP Inspector
pnpm dev:stdio
```

### HTTP Server

```bash
# Build the project
pnpm build

# Run the HTTP server (default: http://localhost:3000)
pnpm start:http

# Run with custom port
PORT=8080 pnpm start:http

# Test with MCP Inspector
pnpm dev:http
```

## Configuration

### Stdio Server Configuration

For Claude Desktop, add to your config file:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "rick_n_morty": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-example/build/stdio-server.js"]
    }
  }
}
```

### HTTP Server Configuration

For HTTP-based MCP clients:

```json
{
  "mcpServers": {
    "rick_n_morty": {
      "type": "streamable-http",
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

## Architecture

Both servers share the same core MCP implementation:

```
┌─────────────────────────────────────────┐
│         server.ts (shared logic)        │
│  - Tools (query, OAuth, etc.)           │
│  - Resources (notes)                     │
│  - Request handlers                      │
└─────────────┬───────────────────────────┘
              │
      ┌───────┴────────┐
      │                │
┌─────▼─────┐    ┌────▼──────┐
│   Stdio   │    │   HTTP    │
│ Transport │    │ Transport │
│           │    │           │
│  stdin/   │    │  Express  │
│  stdout   │    │   + SSE   │
└───────────┘    └───────────┘
```

## OAuth Considerations

### With Stdio Transport

When using stdio transport, OAuth flows require:
1. The server can initiate OAuth but needs external tools for the browser redirect
2. Tools like `oauth_configure`, `oauth_initiate`, and `oauth_complete` still work
3. The authorization URL must be opened in a browser manually
4. The callback must be handled externally (or use a temporary HTTP server)

### With HTTP Transport

The HTTP server includes:
- Built-in OAuth endpoints (`/authorize`, `/token`, `/revoke`)
- Mock OAuth server for development/testing
- Direct support for OAuth redirect flows
- Automatic token management

## Testing

### Test Stdio Server

```bash
# With MCP Inspector
pnpm dev:stdio

# Or directly
node build/stdio-server.js
```

The server will wait for JSON-RPC messages on stdin.

### Test HTTP Server

```bash
# Start the server
pnpm start:http

# Check health
curl http://localhost:3000/health

# Connect with MCP Inspector
pnpm dev:http
```

## Example Usage

### Stdio Server with Claude Desktop

1. Build and configure:
```bash
pnpm build
# Add config to Claude Desktop
```

2. Restart Claude Desktop

3. Ask Claude to use the tools:
   - "Query the Rick and Morty API for character 1"
   - "Create a note called 'test'"

### HTTP Server with OAuth

1. Start the server:
```bash
pnpm start:http
```

2. Configure OAuth:
```
Use oauth_configure with your credentials
```

3. Authenticate:
```
Use oauth_initiate to get authorization URL
Visit URL and authorize
Use oauth_complete with the callback code
```

4. Make authenticated queries:
```
Use the query tool with authentication
```

## Migration Between Transports

The servers are compatible - you can switch between them without changing your core server logic:

```typescript
// Your server logic stays the same
const server = createMCPServer();

// Just change the transport:

// Option 1: Stdio
const stdioTransport = new StdioServerTransport();
await server.connect(stdioTransport);

// Option 2: HTTP
const httpTransport = new StreamableHTTPServerTransport({...});
await server.connect(httpTransport);
```

## Troubleshooting

### Stdio Server Issues

**Problem:** Server not responding
- Check that the path in your client config is absolute
- Verify the build output exists: `ls build/stdio-server.js`
- Check stderr output for error messages

**Problem:** Claude Desktop not seeing the server
- Restart Claude Desktop after config changes
- Check the JSON syntax in the config file
- Verify node is in your PATH

### HTTP Server Issues

**Problem:** Port already in use
- Change the port: `PORT=8080 pnpm start:http`
- Check what's using the port: `lsof -i :3000`

**Problem:** Cannot connect to server
- Verify the server is running: `curl http://localhost:3000/health`
- Check firewall settings
- Ensure the URL in your client config is correct

## Further Reading

- [MCP Specification](https://modelcontextprotocol.io/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [HTTP Server Guide](./HTTP_SERVER_GUIDE.md)
- [Transport Comparison](./TRANSPORT_COMPARISON.md)
