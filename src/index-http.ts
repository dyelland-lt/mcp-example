#!/usr/bin/env node

import express from "express";
import cors from "cors";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createMCPServer } from "./server.js";

/**
 * HTTP Server for MCP with Server-Sent Events (SSE)
 *
 * This server uses SSE for MCP communication, which is required for OAuth support.
 * The SSE transport allows the server to maintain persistent connections with clients
 * and handle bidirectional communication over HTTP.
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

// MCP SSE endpoint
app.get("/sse", async (req, res) => {
  console.log("New SSE connection established");

  // Set headers for SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // Create a new MCP server instance for this connection
  const server = createMCPServer();

  // Create SSE transport
  const transport = new SSEServerTransport("/messages", res);

  // Connect the server to the transport
  await server.connect(transport);

  console.log("MCP server connected via SSE");

  // Handle client disconnect
  req.on("close", () => {
    console.log("SSE connection closed");
    server.close();
  });
});

// MCP message endpoint (for client-to-server messages)
app.post("/messages", async (req, res) => {
  // This endpoint is handled by the SSE transport
  // We need to route messages to the appropriate server instance
  // For now, return a simple acknowledgment
  res.json({ received: true });
});

// Start the server
app.listen(PORT, HOST, () => {
  console.log(`MCP HTTP Server running on http://${HOST}:${PORT}`);
  console.log(`SSE endpoint: http://${HOST}:${PORT}/sse`);
  console.log(`Health check: http://${HOST}:${PORT}/health`);
  console.log("\nTo connect, use the SSE endpoint with an MCP client.");
});

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\nShutting down server...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\nShutting down server...");
  process.exit(0);
});
