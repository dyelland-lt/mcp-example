#!/usr/bin/env node

import express from "express";
import cors from "cors";
import {StreamableHTTPServerTransport} from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {ProxyOAuthServerProvider} from "@modelcontextprotocol/sdk/server/auth/providers/proxyProvider.js";
import {mcpAuthRouter} from "@modelcontextprotocol/sdk/server/auth/router.js";
import {createMCPServer} from "./server.js";
import {createOAuth2Middleware} from "./mock-oauth-server.js";

/**
 * HTTP Server for MCP with Streamable HTTP Transport and OAuth
 *
 * This server consolidates both the MCP server and mock OAuth server into a single
 * Express application. The MCP server uses streamable HTTP for communication, and
 * the OAuth endpoints are mounted under /oauth2 following standard conventions.
 */

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const HOST = process.env.HOST || "localhost";
const BASE_URL = `http://${HOST}:${PORT}`;
const OAUTH_BASE_URL = `${BASE_URL}/oauth2`;

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

// Initialize mock OAuth2 server middleware
const {router: oauth2Router, oauth2Server} = await createOAuth2Middleware({
  issuerUrl: OAUTH_BASE_URL
});

// Mount OAuth2 endpoints under /oauth2
app.use("/oauth2", oauth2Router);

// Configure OAuth proxy provider pointing to our OAuth endpoints
const proxyProvider = new ProxyOAuthServerProvider({
  endpoints: {
    authorizationUrl: `${OAUTH_BASE_URL}/authorize`,
    tokenUrl: `${OAUTH_BASE_URL}/token`,
    revocationUrl: `${OAUTH_BASE_URL}/revoke`
  },
  verifyAccessToken: async (token) => {
    return {
      token,
      clientId: "mock-client-id",
      scopes: ["openid", "email", "profile"]
    };
  },
  getClient: async (client_id) => {
    return {
      client_id,
      redirect_uris: [`http://${HOST}:${PORT}/callback`]
    };
  }
});

// OAuth protected resource metadata endpoint
app.get("/.well-known/oauth-protected-resource/mcp", (_req, res) => {
  res.json({
    resource: `${BASE_URL}/mcp`,
    authorization_servers: [OAUTH_BASE_URL],
    scopes_supported: ["openid", "email", "profile"],
    bearer_methods_supported: ["header", "body"]
  });
});

// Mount MCP auth router
app.use(
  mcpAuthRouter({
    provider: proxyProvider,
    issuerUrl: new URL(OAUTH_BASE_URL),
    baseUrl: new URL(BASE_URL),
    serviceDocumentationUrl: new URL("https://docs.example.com/")
  })
);

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
  console.log(`  Authorization: ${OAUTH_BASE_URL}/authorize`);
  console.log(`  Token:         ${OAUTH_BASE_URL}/token`);
  console.log(`  Revocation:    ${OAUTH_BASE_URL}/revoke`);
  console.log(`  Registration:  ${OAUTH_BASE_URL}/register`);
  console.log(`  JWKS:          ${OAUTH_BASE_URL}/jwks`);
  console.log(`  Discovery:     ${OAUTH_BASE_URL}/.well-known/oauth-authorization-server`);
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
