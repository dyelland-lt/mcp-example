# Example MCP Server

A simple example Model Context Protocol (MCP) server that demonstrates basic MCP functionality including tools and resources.

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

**Note on Transport**: This server uses STDIO transport for MCP communication. Per the MCP spec, OAuth authorization is primarily designed for HTTP-based transports. The OAuth implementation here is provided as a reference and for scenarios where the server makes authenticated requests to external HTTP APIs (like GraphQL endpoints).

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

Run the server directly:
```bash
pnpm start
```

Or build and run in one command:
```bash
pnpm dev
```

### Using with Claude Desktop

To use this MCP server with Claude Desktop, add it to your Claude configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "example": {
      "command": "node",
      "args": ["/Users/dyelland/Repos/mcp_example/build/index.js"]
    }
  }
}
```

After updating the config, restart Claude Desktop.

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
│   ├── index.ts          # Main server implementation
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
- **stdio** transport for communication

## How It Works

The server:
1. Listens on stdio for MCP protocol messages
2. Implements handlers for tool calls and resource reads
3. Maintains an in-memory store for notes
4. Returns responses according to the MCP protocol specification

## Learn More

- [Model Context Protocol Documentation](https://modelcontextprotocol.io/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
