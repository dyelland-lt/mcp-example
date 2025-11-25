#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMCPServer } from "./server.js";

/**
 * Stdio Server for MCP
 *
 * This server provides the same MCP functionality as the HTTP version,
 * but uses stdio (standard input/output) for communication. This is
 * commonly used for local MCP servers that are launched by clients.
 *
 * Usage:
 *   node build/stdio-server.js
 *
 * The server will read MCP protocol messages from stdin and write
 * responses to stdout. This allows clients to spawn the server as
 * a subprocess and communicate directly via pipes.
 */

async function main() {
  // Create the MCP server instance with OAuth disabled for stdio connections
  const server = createMCPServer({ disableOAuth: true });

  // Create stdio transport
  const transport = new StdioServerTransport();

  // Connect server to transport
  await server.connect(transport);

  // Log to stderr (not stdout, which is used for MCP protocol)
  console.error("MCP Stdio Server running (OAuth disabled)");
  console.error("Ready to accept connections via stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
