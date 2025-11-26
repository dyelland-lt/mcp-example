# Rick and Morty MCP Server

A Model Context Protocol (MCP) server that demonstrates MCP functionality using HTTPS transport with tools and resources.

## Features

- ✅ **Streamable HTTPS transport** - Fast, efficient communication
- ✅ **TLS secured** - HTTPS for encrypted connections using mkcert
- ✅ **Simple setup** - Just add the URL to Claude Desktop
- ✅ **Public access** - Expose your local server with ngrok

## Prerequisites

- Node.js and pnpm
- [mkcert](https://github.com/FiloSottile/mkcert) for local SSL certificates
- [ngrok](https://ngrok.com/) for exposing your local server publicly (optional, for remote access)

### Installing mkcert

mkcert is a simple tool for making locally-trusted development certificates.

**macOS:**
```bash
brew install mkcert
mkcert -install
```

**Linux:**
```bash
# Install mkcert (method varies by distribution)
# Ubuntu/Debian:
sudo apt install libnss3-tools
wget -O mkcert https://github.com/FiloSottile/mkcert/releases/latest/download/mkcert-v*-linux-amd64
chmod +x mkcert
sudo mv mkcert /usr/local/bin/
mkcert -install
```

**Windows:**
```bash
choco install mkcert
mkcert -install
```

### Installing ngrok

ngrok creates secure tunnels to your localhost.

**macOS:**
```bash
brew install ngrok/ngrok/ngrok
```

**Linux/Windows:**
Download from [ngrok.com/download](https://ngrok.com/download)

**Setup (all platforms):**
```bash
# Sign up at ngrok.com and get your authtoken
ngrok config add-authtoken <your-token>
```

## What This Does

This server acts as a bridge between Claude Desktop and the Rick and Morty API, allowing you to:
- Search for characters by name, status, species, type, or gender
- Look up episodes by name or episode code
- Find locations by name, type, or dimension
- Get detailed information about any character, episode, or location by ID
- Batch query multiple items at once

# Generate SSL certificates with mkcert
cd certs
mkcert localhost 127.0.0.1 ::1
mv localhost+2.pem localhost-cert.pem
mv localhost+2-key.pem localhost-key.pem
cd ..

# Build the project
pnpm build

# Run the HTTPS server
pnpm start
```

## Connecting to Claude Desktop

### Prerequisites
- Claude Desktop with Pro, Max, Team, or Enterprise plan
- Server running locally with HTTPS (using mkcert)
- ngrok for public access (optional)

### Local Testing

1. **Start the server**:
   ```bash
   pnpm start
   ```

2. **Test locally with MCP Inspector**:
   ```bash
   pnpm dev
   ```

### Remote Access with ngrok

To make your local server accessible to Claude Desktop:

1. **Start the server**:
   ```bash
   HOST=0.0.0.0 pnpm start
   ```

2. **In a separate terminal, start ngrok**:
   ```bash
   ngrok http 3000
   ```

   Or use the convenience script:
   ```bash
   pnpm start:public
   ```

3. **Copy the ngrok HTTPS URL** (e.g., `https://abc123.ngrok-free.app`)

4. **Add to Claude Desktop**:
   - Open Claude Desktop
   - Go to **Settings > Connectors**
   - Click "Add custom connector"
   - Enter your ngrok URL with the `/mcp` path: `https://abc123.ngrok-free.app/mcp`
   - Click "Add"

   **Note:** Do NOT add the server via `claude_desktop_config.json` - Claude Desktop will not connect to remote servers configured that way.

5. **Start using it**: Claude Desktop will connect immediately!

## What This Server Provides

### Tools
- **query**: Query the Rick and Morty GraphQL API for characters, episodes, and locations

### Resources
- **rickandmorty://characters/popular**: A curated list of popular Rick and Morty characters
- **rickandmorty://info/api**: Information about the Rick and Morty API capabilities

### Prompts
- **character-analysis**: Analyze a character's personality and role
- **episode-summary**: Get information about a specific episode
- **character-comparison**: Compare two characters from the show

Example result: `/Users/yourname/projects/mcp-example`

Your config would then be:
```json
{
  "mcpServers": {
    "rick_and_morty": {
      "command": "node",
      "args": [
        "/Users/yourname/projects/mcp-example/build/stdio-server.js"
      ]
    }
  }
}
```

### Step 3: Restart Claude Desktop

Completely quit and restart Claude Desktop (not just close the window).

### Step 4: Verify

1. Open Claude Desktop
2. Look for the 🔌 icon in the bottom-right
3. Click it to see your connected MCP servers
4. "rick_and_morty" should be listed

## Usage

Once connected, you can ask Claude questions about Rick and Morty data:

```bash
# Local development
pnpm start

# For public access (binds to all interfaces)
HOST=0.0.0.0 pnpm start

# With MCP Inspector for testing
pnpm dev

# Run with ngrok for public access
pnpm start:public
```

The HTTPS server will start on `https://localhost:3000` by default.

**Environment Variables:**
- `PORT` - Server port (default: 3000)
- `HOST` - Bind address (default: localhost, use 0.0.0.0 for public access)

**Endpoints:**
- `/mcp` - MCP endpoint for Claude Desktop
- `/health` - Health check endpoint

### Testing the Server

Once connected to Claude Desktop, you can test with queries like:

- "Find all alive characters named Rick"
- "Get character with ID 1"
- "Show me episodes from season 1"
- "Analyze the character Morty Smith"
- "Compare Rick and Morty's personalities"
- "Tell me about episode S01E01"

## Project Structure

```
mcp-example/
├── src/
│   ├── http-server.ts      # HTTPS server with Express
│   ├── server.ts           # MCP server logic with tools and resources
│   └── config.json         # Server configuration
├── build/                  # Compiled JavaScript (generated)
├── certs/                  # SSL certificates (generate with mkcert)
├── start-public.sh         # Script to start server with ngrok
├── package.json            # Project dependencies and scripts
├── tsconfig.json           # TypeScript configuration
└── README.md              # This file
```

## Development

The server uses:
- **TypeScript** for type safety
- **@modelcontextprotocol/sdk** for MCP protocol implementation
- **Streamable HTTPS transport** for secure web-based communication
- **Express** for HTTPS server
- **mkcert** for local SSL certificates
- **ngrok** for public tunneling
- **graphql-request** for querying the Rick and Morty API

## How It Works

1. The server listens on HTTPS for secure MCP protocol messages
2. SSL certificates are generated using mkcert for local development
3. Handles tool calls and resource reads via the MCP protocol
4. Queries the Rick and Morty GraphQL API
5. Returns responses according to the MCP protocol specification
6. Can be exposed publicly using ngrok for Claude Desktop access

- [Model Context Protocol](https://modelcontextprotocol.io)
- [Rick and Morty API](https://rickandmortyapi.com)
- [Claude Desktop](https://claude.ai/desktop)
