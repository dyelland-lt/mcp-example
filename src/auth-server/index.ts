#!/usr/bin/env node

import express from "express";
import cors from "cors";
import { createOAuth2Middleware } from "./middleware.js";

/**
 * Standalone OAuth2 Mock Server
 *
 * This is a standalone OAuth2 authorization server that can be run independently
 * for testing and development purposes. It provides:
 * - OAuth2 Authorization Code Flow with PKCE
 * - Token issuance and refresh
 * - Dynamic client registration (RFC 7591)
 * - Protected Resource Metadata (RFC 9728)
 * - Authorization Server Metadata (RFC 8414)
 *
 * This server can be used to test OAuth flows for MCP servers or any other
 * OAuth2 clients. It generates valid JWTs signed with RS256.
 *
 * Usage:
 *   PORT=4000 node build/auth-server/index.js
 *   npm run start:auth
 */

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 4000;
const HOST = process.env.HOST || "localhost";
const BASE_URL = `http://${HOST}:${PORT}`;

async function main() {
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
      server: "OAuth2 Mock Server",
      timestamp: new Date().toISOString()
    });
  });

  // Initialize mock OAuth2 server middleware
  const { router: oauth2Router, oauth2Server } = await createOAuth2Middleware({
    issuerUrl: BASE_URL
  });

  // Mount OAuth2 endpoints at root
  app.use("/", oauth2Router);

  // Start the server
  const httpServer = app.listen(PORT, HOST, () => {
    console.log("\n" + "=".repeat(60));
    console.log("🔐 OAuth2 Mock Server");
    console.log("=".repeat(60));
    console.log(`\n🚀 Server running on ${BASE_URL}`);
    console.log("\n📋 Endpoints:");
    console.log(`  Health:        ${BASE_URL}/health`);
    console.log(`  Authorization: ${BASE_URL}/authorize`);
    console.log(`  Token:         ${BASE_URL}/token`);
    console.log(`  Revocation:    ${BASE_URL}/revoke`);
    console.log(`  Registration:  ${BASE_URL}/register`);
    console.log(`  JWKS:          ${BASE_URL}/jwks`);
    console.log("\n🔍 Discovery:");
    console.log(`  OAuth Server:  ${BASE_URL}/.well-known/oauth-authorization-server`);
    console.log(`  OpenID:        ${BASE_URL}/.well-known/openid-configuration`);
    console.log(`  Protected:     ${BASE_URL}/.well-known/oauth-protected-resource`);
    console.log("\n✨ Features:");
    console.log("  ✓ Authorization Code Flow with PKCE");
    console.log("  ✓ Token Refresh");
    console.log("  ✓ Dynamic Client Registration");
    console.log("  ✓ RFC 8414 (OAuth Server Metadata)");
    console.log("  ✓ RFC 9728 (Protected Resource Metadata)");
    console.log("  ✓ RS256 Signed JWTs");
    console.log("\n" + "=".repeat(60));
    console.log("✅ Server ready\n");
  });

  // Handle graceful shutdown
  const shutdown = async () => {
    console.log("\n🛑 Shutting down OAuth2 server...");
    // The oauth2-mock-server doesn't need explicit cleanup
    httpServer.close(() => {
      console.log("✅ Server closed");
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error("❌ Fatal error starting OAuth2 server:", error);
  process.exit(1);
});
