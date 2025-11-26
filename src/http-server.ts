#!/usr/bin/env node

import express from "express";
import cors from "cors";
import https from "https";
import fs from "fs";
import path from "path";
import {networkInterfaces} from "os";
import {StreamableHTTPServerTransport} from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {createMCPServer} from "./server.js";

/**
 * HTTPS Server for MCP with Streamable HTTP Transport
 *
 * This server provides the MCP server using streamable HTTPS for communication.
 */

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const HOST = process.env.HOST || "localhost";
const BASE_URL = `https://${HOST}:${PORT}`;

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

// Health check endpoint
app.get("/health", (_req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString()
  });
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

// Load SSL certificates
const certPath = path.join(process.cwd(), "certs", "localhost-cert.pem");
const keyPath = path.join(process.cwd(), "certs", "localhost-key.pem");

const httpsOptions = {
  cert: fs.readFileSync(certPath),
  key: fs.readFileSync(keyPath)
};

// Start the HTTPS server
const httpsServer = https.createServer(httpsOptions, app);
httpsServer.listen(PORT, HOST, () => {
  console.log(`🚀 MCP HTTPS Server running on ${BASE_URL}`);
  console.log("\n📡 Endpoints:");
  console.log(`  MCP:    ${BASE_URL}/mcp`);
  console.log(`  Health: ${BASE_URL}/health`);

  // Check for local network IP and warn about SSL certificate
  if (HOST === "0.0.0.0" || HOST === "localhost") {
    const nets = networkInterfaces();
    const localIPs: string[] = [];

    for (const name of Object.keys(nets)) {
      const netInfo = nets[name];
      if (!netInfo) continue;

      for (const net of netInfo) {
        // Skip internal (loopback) and non-IPv4 addresses
        if (net.family === "IPv4" && !net.internal) {
          localIPs.push(net.address);
        }
      }
    }

    if (localIPs.length > 0) {
      console.log("\n⚠️  Local Network Access:");
      console.log(`  Your machine's IP: ${localIPs.join(", ")}`);
      console.log(`  For Claude Desktop, use: https://${localIPs[0]}:${PORT}/mcp`);
      console.log("\n⚠️  SSL Certificate Warning:");
      console.log(`  Current certificate is valid for: localhost, 127.0.0.1`);
      console.log(`  To access via ${localIPs[0]}, you need to regenerate the certificate.`);
      console.log(`  Run: openssl req -x509 -newkey rsa:4096 -keyout certs/localhost-key.pem \\`);
      console.log(`       -out certs/localhost-cert.pem -days 365 -nodes \\`);
      console.log(`       -subj "/CN=localhost" \\`);
      console.log(`       -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:${localIPs[0]}"`);
    }
  }

  console.log("\n✅ Server ready (secured with TLS)");
});

// Handle graceful shutdown
const shutdown = async () => {
  console.log("\nShutting down server...");
  await transport.close();
  await server.close();
  httpsServer.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
