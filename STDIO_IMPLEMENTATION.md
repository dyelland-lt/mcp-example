# Stdio Server Implementation Summary

## What Was Created

A new **stdio-based MCP server** that provides an alternative transport method to the existing HTTP server.

## Files Created/Modified

### New Files
- **`src/stdio-server.ts`** - Stdio transport server implementation
- **`src/config-stdio.json`** - Configuration for stdio server
- **`STDIO_SERVER_GUIDE.md`** - Complete guide for using the stdio server

### Modified Files
- **`package.json`** - Added `start:stdio` and `dev:stdio` scripts
- **`README.md`** - Updated documentation to cover both transports

### Generated Files (from build)
- **`build/stdio-server.js`** - Compiled stdio server
- **`build/stdio-server.d.ts`** - TypeScript definitions

## Key Differences: Stdio vs HTTP

| Feature | Stdio Server | HTTP Server |
|---------|-------------|-------------|
| **Transport** | stdin/stdout | HTTP + SSE |
| **Use Case** | Local clients (Claude Desktop) | Web clients, OAuth flows |
| **Setup** | Simpler | More complex |
| **OAuth** | Requires external handling | Built-in support |
| **Network** | Local only | Can be remote |
| **Port** | Not needed | Requires port (default 3000) |
| **Security** | Process-level | Network-level |

## Running the Servers

### Stdio Server
```bash
pnpm build
pnpm start:stdio
```

### HTTP Server
```bash
pnpm build
pnpm start:http
```

## Configuration Examples

### For Claude Desktop (Stdio)
```json
{
  "mcpServers": {
    "rick_n_morty": {
      "command": "node",
      "args": ["/path/to/mcp-example/build/stdio-server.js"]
    }
  }
}
```

### For HTTP Clients
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

Both servers share the **same core MCP logic** (`server.ts`):
- Tools (query, OAuth, create_note, etc.)
- Resources (notes)
- Request handlers

The only difference is the **transport layer**:
- **Stdio**: `StdioServerTransport` from MCP SDK
- **HTTP**: `StreamableHTTPServerTransport` + Express

## Benefits of Stdio Transport

1. **Simplicity** - No port configuration, no CORS, no network setup
2. **Performance** - Direct pipe communication is faster than HTTP
3. **Security** - No network exposure, process-level isolation
4. **Standard** - Well-established pattern for CLI tools
5. **Debugging** - Can pipe JSON directly for testing

## Testing

### Quick Test (Stdio)
```bash
# Build
pnpm build

# Test with inspector
pnpm dev:stdio
```

### Quick Test (HTTP)
```bash
# Start server
pnpm start:http

# In another terminal
curl http://localhost:3000/health
```

## Implementation Notes

1. **Shared Core**: Both servers use `createMCPServer()` from `server.ts`
2. **Transport Independence**: Easy to switch between transports
3. **Error Handling**: Stdio logs to stderr, HTTP logs to stdout
4. **OAuth**: Both support OAuth tools, but HTTP has better redirect handling
5. **Production Ready**: Both servers include proper error handling and graceful shutdown

## Next Steps

You can now:
1. Use the stdio server with Claude Desktop
2. Use the HTTP server for web clients or OAuth flows
3. Switch between them based on your needs
4. Extend the core `server.ts` to add more tools (changes apply to both)

## Documentation

- **[STDIO_SERVER_GUIDE.md](./STDIO_SERVER_GUIDE.md)** - Complete stdio server guide
- **[README.md](./README.md)** - Main documentation (updated)
- **[HTTP_SERVER_GUIDE.md](./HTTP_SERVER_GUIDE.md)** - HTTP server guide
- **[TRANSPORT_COMPARISON.md](./TRANSPORT_COMPARISON.md)** - Transport comparison
