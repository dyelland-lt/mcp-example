# Example MCP Server

A simple example Model Context Protocol (MCP) server that demonstrates basic MCP functionality including tools, resources, and OAuth authentication.

## Quick Start

```bash
# Install dependencies
pnpm install

# Build the project
pnpm build

# Run with STDIO transport (for Claude Desktop)
pnpm start

# Run with HTTP transport (for OAuth support)
pnpm start:http
```

## Features

This server provides:

### Tools

#### Basic Tools
- **add**: Add two numbers together
- **echo**: Echo back a message
- **create_note**: Create a note with a key and content
- **get_timestamp**: Get the current server timestamp

#### GraphQL Tools
- **rick_and_morty_query**: Query the Rick and Morty GraphQL API for characters, episodes, and locations

#### OAuth Tools (MCP Authorization Spec Compliant)
- **oauth_configure**: Configure OAuth 2.0 settings for your GraphQL API
- **oauth_initiate**: Start the OAuth authorization flow with PKCE
- **oauth_complete**: Complete OAuth flow by exchanging authorization code for tokens
- **oauth_status**: Check current authentication status
- **oauth_logout**: Clear stored tokens and log out

### MCP Authorization Specification Compliance

This implementation complies with the [MCP Authorization Specification](https://modelcontextprotocol.io/specification/draft/authorization) including:

- ✅ **RFC 8707 Resource Indicators**: Binds tokens to specific MCP servers
- ✅ **RFC 9728 Protected Resource Metadata**: Discovery of authorization servers
- ✅ **RFC 8414 Authorization Server Metadata**: Endpoint discovery with OpenID Connect fallback
- ✅ **PKCE (S256) with verification**: Mandatory security for authorization code flow
- ✅ **Scope Selection Strategy**: WWW-Authenticate → scopes_supported → omit
- ✅ **Insufficient Scope Handling**: Step-up authorization for HTTP 403 responses
- ✅ **Client ID Metadata Documents**: Support for HTTPS URL-based client identification

**Transport Options**: This server supports both STDIO and HTTP transports:
- **STDIO transport** (`pnpm start`): For standard MCP communication with clients like Claude Desktop
- **HTTP transport with SSE** (`pnpm start:http`): For OAuth-enabled MCP communication over HTTP

Per the MCP spec, OAuth authorization is designed for HTTP-based transports. Use the HTTP server (`pnpm start:http`) when you need full OAuth support. The STDIO version can still use OAuth for authenticating requests to external APIs (like GraphQL endpoints).

### Resources
- **note://** URI scheme for accessing notes
- Pre-loaded welcome and info notes
- Dynamic listing of user-created notes

## Installation

1. Install dependencies:
```bash
pnpm install
```

2. Build the server:
```bash
pnpm build
```

## Usage

### Running the Server

The server supports two transport modes:

#### STDIO Transport (default)

For use with MCP clients that use stdio communication:

```bash
# Production mode
pnpm start

# Development mode with inspector
pnpm dev
```

#### HTTP Transport (for OAuth support)

For OAuth authentication, use the HTTP server with Server-Sent Events (SSE):

```bash
# Production mode
pnpm start:http

# Development mode with hot reload
pnpm dev:http
```

The HTTP server will start on `http://localhost:3000` by default. You can configure the host and port:

```bash
# Custom port and host
PORT=8080 HOST=0.0.0.0 pnpm start:http
```

**Endpoints:**
- `GET /sse` - MCP SSE connection endpoint
- `POST /messages` - Client-to-server message endpoint
- `GET /health` - Health check endpoint

### Using with MCP Clients

#### Claude Desktop (STDIO)

To use this MCP server with Claude Desktop, add it to your Claude configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "example": {
      "command": "node",
      "args": ["/Users/dyelland/Repos/mcp-example/build/index.js"]
    }
  }
}
```

After updating the config, restart Claude Desktop.

#### HTTP-based MCP Clients (with OAuth)

For MCP clients that support HTTP transport with OAuth:

1. Start the HTTP server:
```bash
pnpm start:http
```

2. Connect your client to the SSE endpoint:
```
http://localhost:3000/sse
```

3. Use the OAuth tools to authenticate with your API.

### Testing the Server

Once connected, you can test the tools:

#### Basic Tools
1. **Add numbers**: Ask Claude to "add 5 and 3 using the add tool"
2. **Echo message**: "Echo the message 'Hello World'"
3. **Create note**: "Create a note with key 'test' and content 'This is a test'"
4. **Get timestamp**: "What's the current timestamp?"
5. **Read resources**: "Read the welcome note"

#### GraphQL Queries
- "Find all alive characters named Rick"
- "Get character with ID 1"
- "Show me episodes from season 1"

#### OAuth Authentication Flow

For authenticating with your own GraphQL API:

1. **Configure OAuth**:
```
Configure OAuth with:
- Client ID: your_client_id
- Authorization URL: https://your-api.com/oauth/authorize
- Token URL: https://your-api.com/oauth/token
- Redirect URI: http://localhost:3000/callback
```

2. **Initiate Flow**: Ask to "start OAuth authentication"
3. **Visit URL**: Open the returned authorization URL in a browser
4. **Complete**: After redirect, use the code to complete authentication
5. **Check Status**: "What's my OAuth status?"

The server will automatically:
- Use OAuth tokens for authenticated GraphQL requests
- Refresh expired tokens automatically
- Fall back to unauthenticated requests if not logged in

## Project Structure

```
mcp-example/
├── src/
│   ├── index.ts          # STDIO server entry point
│   ├── index-http.ts     # HTTP server entry point (OAuth-enabled)
│   ├── server.ts         # Shared MCP server logic
│   ├── oauth.ts          # OAuth 2.0 flow with PKCE
│   └── token-manager.ts  # Token storage and refresh logic
├── build/                # Compiled JavaScript (generated)
├── package.json          # Project dependencies and scripts
├── tsconfig.json         # TypeScript configuration
└── README.md            # This file
```

## Development

The server uses:
- **TypeScript** for type safety
- **@modelcontextprotocol/sdk** for MCP protocol implementation
- **Express** for HTTP server (OAuth-enabled mode)
- **Server-Sent Events (SSE)** for bidirectional MCP communication over HTTP
- **STDIO** or **HTTP** transport for communication

## How It Works

The server:
1. Listens on stdio for MCP protocol messages
2. Implements handlers for tool calls and resource reads
3. Maintains an in-memory store for notes
4. Returns responses according to the MCP protocol specification

## Documentation

- **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)** - Quick reference card for common tasks ⭐
- **[MIGRATION_SUMMARY.md](./MIGRATION_SUMMARY.md)** - Overview of HTTP transport conversion
- **[HTTP_SERVER_GUIDE.md](./HTTP_SERVER_GUIDE.md)** - HTTP server connection guide
- **[TRANSPORT_COMPARISON.md](./TRANSPORT_COMPARISON.md)** - STDIO vs HTTP comparison
- **[OAUTH_EXAMPLE.md](./OAUTH_EXAMPLE.md)** - OAuth authentication examples
- **[MCP_COMPLIANCE.md](./MCP_COMPLIANCE.md)** - MCP specification compliance details

## Learn More

- [Model Context Protocol Documentation](https://modelcontextprotocol.io/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCP Authorization Specification](https://modelcontextprotocol.io/specification/draft/authorization)
