#!/usr/bin/env node

import express from "express";
import cors from "cors";
import { randomUUID } from "crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMCPServer } from "./server.js";

/**
 * HTTP Server for MCP with Streamable HTTP Transport
 *
 * This server uses streamable HTTP for MCP communication, which is required for OAuth support.
 * The streamable HTTP transport supports both SSE streaming and direct HTTP responses,
 * allowing for bidirectional communication over standard HTTP.
 */

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const HOST = process.env.HOST || "localhost";

const app = express();

// Enable CORS for cross-origin requests
app.use(cors({
  origin: true,
  credentials: true
}));

// Parse JSON bodies
app.use(express.json());

// Health check endpoint
app.get("/health", (_req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
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
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

// Start the server
const httpServer = app.listen(PORT, HOST, () => {
  console.log(`MCP HTTP Server running on http://${HOST}:${PORT}`);
  console.log(`MCP endpoint: http://${HOST}:${PORT}/mcp`);
  console.log(`Health check: http://${HOST}:${PORT}/health`);
  console.log("\nSupports both SSE (GET /mcp) and direct messages (POST /mcp)");
  console.log("MCP server ready");
});

// Handle graceful shutdown
const shutdown = async () => {
  console.log("\nShutting down server...");
  await transport.close();
  await server.close();
  httpServer.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
