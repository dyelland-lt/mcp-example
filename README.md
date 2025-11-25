# Example MCP Server

A simple example Model Context Protocol (MCP) server that demonstrates basic MCP functionality including tools, resources, and OAuth authentication.

## Quick Start

```bash
# Install dependencies
pnpm install

# Build the project
pnpm build

# Run with Stdio transport (default - for local clients)
pnpm start:stdio

# Run with HTTP transport (for OAuth and web clients)
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

#### Stdio Transport

For use with MCP clients that communicate via standard input/output (like Claude Desktop):

```bash
# Production mode
pnpm start:stdio

# Development mode with inspector
pnpm dev:stdio
```

The stdio server reads MCP protocol messages from stdin and writes responses to stdout. This is the simplest transport and is commonly used for local MCP servers.

#### HTTP Transport

For OAuth authentication and web-based clients, use the HTTP server with Streamable HTTP:

```bash
# Production mode
pnpm start:http

# Development mode with inspector
pnpm dev:http
```

The HTTP server will start on `http://localhost:3000` by default. You can configure the host and port:

```bash
# Custom port and host
PORT=8080 HOST=0.0.0.0 pnpm start:http
```

**Endpoints:**
- `/mcp` - MCP streamable HTTP endpoint (GET for SSE, POST for messages)
- `/health` - Health check endpoint
- `/authorize` - OAuth authorization endpoint
- `/token` - OAuth token endpoint

### Using with MCP Clients

#### Claude Desktop (Stdio)

To use the stdio server with Claude Desktop, add it to your Claude configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

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

After updating the config, restart Claude Desktop.

#### MCP Inspector (Stdio)

Test the stdio server with the MCP Inspector:

```bash
pnpm dev:stdio
```

This will launch the server with the inspector UI for testing tools and resources.

#### HTTP-based MCP Clients

For MCP clients that support HTTP transport:

1. Start the HTTP server:
```bash
pnpm start:http
```

2. Connect your client to the MCP endpoint:
```
http://localhost:3000/mcp
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
│   ├── stdio-server.ts   # Stdio transport server entry point
│   ├── index.ts          # HTTP transport server entry point
│   ├── server.ts         # Shared MCP server logic
│   ├── oauth.ts          # OAuth 2.0 flow with PKCE
│   ├── token-manager.ts  # Token storage and refresh logic
│   ├── config.json       # HTTP server configuration
│   └── config-stdio.json # Stdio server configuration
├── build/                # Compiled JavaScript (generated)
├── package.json          # Project dependencies and scripts
├── tsconfig.json         # TypeScript configuration
└── README.md            # This file
```

## Development

The server uses:
- **TypeScript** for type safety
- **@modelcontextprotocol/sdk** for MCP protocol implementation
- **Stdio transport** for local subprocess communication
- **Streamable HTTP transport** for web-based clients with OAuth support
- **Express** for HTTP server (OAuth-enabled mode)

## How It Works

The server:
1. Listens on stdio for MCP protocol messages
2. Implements handlers for tool calls and resource reads
3. Maintains an in-memory store for notes
4. Returns responses according to the MCP protocol specification

## OAuth for Stdio Servers

**New!** The server now supports OAuth authentication for stdio transport, where the **MCP server itself** (not the end user) authenticates with OAuth providers.

### Key Features
- ✅ **offline_access scope** - Refresh tokens for long-lived access
- ✅ **Automatic token refresh** - Never expires as long as refresh token is valid
- ✅ **Environment variable configuration** - Easy integration with Claude Desktop
- ✅ **Helper tools** - Automated token acquisition

### Quick Start

1. **Get OAuth tokens** with the helper tool:
```bash
# Start the OAuth mock server
npm run start:auth

# In another terminal, get tokens
npm run get-tokens
```

2. **Set environment variables** (from the output of step 1):
```bash
export OAUTH_ACCESS_TOKEN="eyJhbGc..."
export OAUTH_REFRESH_TOKEN="mock-refresh-token-abc123"
export OAUTH_TOKEN_URL="http://localhost:4000/token"
export OAUTH_CLIENT_ID="my-mcp-server"
```

3. **Run stdio server with OAuth**:
```bash
npm run start:stdio:oauth
```

### For Claude Desktop

Add OAuth credentials to your config:
```json
{
  "mcpServers": {
    "my-oauth-server": {
      "command": "node",
      "args": ["/path/to/build/stdio-server-with-oauth.js"],
      "env": {
        "OAUTH_ACCESS_TOKEN": "your-access-token",
        "OAUTH_REFRESH_TOKEN": "your-refresh-token",
        "OAUTH_TOKEN_URL": "http://localhost:4000/token",
        "OAUTH_CLIENT_ID": "your-client-id"
      }
    }
  }
}
```

**See [OAUTH_STDIO_QUICKSTART.md](./OAUTH_STDIO_QUICKSTART.md) for complete guide** 🚀

## Documentation

- **[OAUTH_STDIO_QUICKSTART.md](./OAUTH_STDIO_QUICKSTART.md)** - OAuth for stdio servers quickstart 🚀 **NEW!**
- **[STDIO_OAUTH_GUIDE.md](./STDIO_OAUTH_GUIDE.md)** - Complete OAuth stdio implementation guide 🔐 **NEW!**
- **[src/auth-server/README.md](./src/auth-server/README.md)** - Standalone OAuth mock server 🔑 **NEW!**
- **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)** - Quick reference card for common tasks ⭐
- **[STDIO_SERVER_GUIDE.md](./STDIO_SERVER_GUIDE.md)** - Complete stdio server guide 📡
- **[STDIO_IMPLEMENTATION.md](./STDIO_IMPLEMENTATION.md)** - Stdio implementation summary
- **[HTTP_SERVER_GUIDE.md](./HTTP_SERVER_GUIDE.md)** - HTTP server connection guide
- **[TRANSPORT_COMPARISON.md](./TRANSPORT_COMPARISON.md)** - STDIO vs HTTP comparison
- **[OAUTH_EXAMPLE.md](./OAUTH_EXAMPLE.md)** - OAuth authentication examples
- **[MCP_COMPLIANCE.md](./MCP_COMPLIANCE.md)** - MCP specification compliance details
- **[MIGRATION_SUMMARY.md](./MIGRATION_SUMMARY.md)** - Overview of HTTP transport conversion

## Learn More

- [Model Context Protocol Documentation](https://modelcontextprotocol.io/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCP Authorization Specification](https://modelcontextprotocol.io/specification/draft/authorization)
