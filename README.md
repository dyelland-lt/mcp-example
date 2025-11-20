# Example MCP Server

A simple example Model Context Protocol (MCP) server that demonstrates basic MCP functionality including tools and resources.

## Features

This server provides:

### Tools
- **add**: Add two numbers together
- **echo**: Echo back a message
- **create_note**: Create a note with a key and content
- **get_timestamp**: Get the current server timestamp

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

1. **Add numbers**: Ask Claude to "add 5 and 3 using the add tool"
2. **Echo message**: "Echo the message 'Hello World'"
3. **Create note**: "Create a note with key 'test' and content 'This is a test'"
4. **Get timestamp**: "What's the current timestamp?"
5. **Read resources**: "Read the welcome note"

## Project Structure

```
mcp_example/
├── src/
│   └── index.ts          # Main server implementation
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
