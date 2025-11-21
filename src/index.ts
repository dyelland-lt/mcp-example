#!/usr/bin/env node

import express from "express";
import cors from "cors";
import {StreamableHTTPServerTransport} from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {createMCPServer} from "./server.js";
import {createOAuth2Middleware} from "./mock-oauth-server.js";

/**
 * HTTP Server for MCP with Streamable HTTP Transport and OAuth
 *
 * This server provides both the MCP server and a mock OAuth server for development/testing.
 * The MCP server uses streamable HTTP for communication, and OAuth endpoints are available
 * under /oauth2. MCP clients can authenticate directly with the OAuth endpoints without
 * requiring the MCP SDK's proxy provider layer.
 */

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const HOST = process.env.HOST || "localhost";
const BASE_URL = `http://${HOST}:${PORT}`;

const app = express();

// Enable CORS for cross-origin requests
app.use(
  cors({
    origin: true,
    credentials: true
  })
);

// Parse JSON bodies
app.use(express.json());

// Initialize mock OAuth2 server middleware at root
const {router: oauth2Router} = await createOAuth2Middleware({
  issuerUrl: BASE_URL
});

// Mount OAuth2 endpoints at root
app.use("/", oauth2Router);

console.log("\n🔧 OAuth2 Server Configuration:");
console.log(`  Issuer URL: ${BASE_URL}`);
console.log(`  Authorization Endpoint: ${BASE_URL}/authorize`);
console.log(`  Token Endpoint: ${BASE_URL}/token`);
console.log(`  Discovery: ${BASE_URL}/.well-known/oauth-authorization-server`);

// Health check endpoint
app.get("/health", (_req, res) => {
  res.json({status: "healthy", timestamp: new Date().toISOString()});
});

// Create a single MCP server instance
const server = createMCPServer();

// Create transport in stateless mode (no session ID required)
// For stateful mode with sessions, set sessionIdGenerator: () => randomUUID()
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: undefined
});

// Connect the server to the transport
await server.connect(transport);

// MCP endpoint for streamable HTTP (handles both GET for SSE and POST for messages)
app.all("/mcp", async (req, res) => {
  console.log(`${req.method} request to /mcp`);

  try {
    // Handle the request through the transport
    // For POST requests, express.json() middleware has already parsed req.body
    await transport.handleRequest(req, res, req.body);
    console.log(`${req.method} request completed`);
  } catch (error) {
    console.error("Error handling MCP request:", error);
    if (!res.headersSent) {
      res.status(500).json({error: "Internal server error"});
    }
  }
});

// Start the server
const httpServer = app.listen(PORT, HOST, () => {
  console.log(`🚀 Consolidated Server running on ${BASE_URL}`);
  console.log("\n📡 MCP Endpoints:");
  console.log(`  MCP:         ${BASE_URL}/mcp`);
  console.log(`  Health:      ${BASE_URL}/health`);
  console.log("\n🔐 OAuth2 Endpoints:");
  console.log(`  Authorization: ${BASE_URL}/authorize`);
  console.log(`  Token:         ${BASE_URL}/token`);
  console.log(`  Revocation:    ${BASE_URL}/revoke`);
  console.log(`  Registration:  ${BASE_URL}/register`);
  console.log(`  JWKS:          ${BASE_URL}/jwks`);
  console.log(`  Discovery:     ${BASE_URL}/.well-known/oauth-authorization-server`);
  console.log("\n✅ Server ready");
});

// Handle graceful shutdown
const shutdown = async () => {
  console.log("\nShutting down server...");
  await transport.close();
  await server.close();
  // Note: oauth2Server doesn't need to be stopped since it's used as middleware
  httpServer.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
