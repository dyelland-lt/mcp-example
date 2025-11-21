#!/usr/bin/env node

import {OAuth2Server} from "oauth2-mock-server";
import express from "express";
import http from "http";
import cors from "cors";

/**
 * Mock OAuth2 Server for Development
 *
 * This is a fully functional OAuth2 server that can be used for testing
 * the MCP OAuth integration. It generates valid JWTs and supports standard
 * OAuth2 flows including authorization code, PKCE, and token refresh.
 */

const MOCK_OAUTH_PORT = 4000;
const MOCK_OAUTH_HOST = "localhost";

// Create our own Express app to wrap the OAuth2 server
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

const oauth2Server = new OAuth2Server();

// Generate a new RSA key and add it to the keystore
await oauth2Server.issuer.keys.generate('RS256');

// Configure the issuer URL
const issuerUrl = `http://${MOCK_OAUTH_HOST}:${MOCK_OAUTH_PORT}`;
oauth2Server.issuer.url = issuerUrl;

// Store for dynamically registered clients
const registeredClients = new Map<string, any>();

// Add custom claims to the generated tokens
oauth2Server.service.once("beforeTokenSigning", (token: any, req: any) => {
  token.payload.sub = "mock-user-123";
  token.payload.email = "user@example.com";
  token.payload.name = "Mock User";
  token.payload.client_id = req.body.client_id || "mock-client-id";
});

// Enable dynamic client registration in discovery document
oauth2Server.service.on(
  "beforeResponse",
  (tokenEndpointResponse: any, req: any) => {
    if (
      req.url === "/.well-known/openid-configuration" ||
      req.url === "/.well-known/oauth-authorization-server"
    ) {
      const discovery = JSON.parse(tokenEndpointResponse.body);
      discovery.registration_endpoint = `${issuerUrl}/register`;
      tokenEndpointResponse.body = JSON.stringify(discovery);
    }
  }
);

// Enable dynamic client registration
oauth2Server.service.on("beforePostRegister", (req: any, res: any) => {
  // Extract client registration request
  const clientMetadata = req.body;

  // Generate a client_id and client_secret
  const client_id = `mock-client-${Date.now()}`;
  const client_secret = `mock-secret-${Math.random()
    .toString(36)
    .substring(7)}`;

  // Store the client
  registeredClients.set(client_id, {
    client_id,
    client_secret,
    ...clientMetadata
  });

  // Return the registered client info
  res.json({
    client_id,
    client_secret,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    ...clientMetadata
  });
});

// Add OAuth authorization server metadata endpoint to our Express app
app.get("/.well-known/oauth-authorization-server", (_req, res) => {
  res.json({
    issuer: issuerUrl,
    authorization_endpoint: `${issuerUrl}/authorize`,
    token_endpoint: `${issuerUrl}/token`,
    revocation_endpoint: `${issuerUrl}/revoke`,
    registration_endpoint: `${issuerUrl}/register`,
    jwks_uri: `${issuerUrl}/jwks`,
    response_types_supported: ["code", "token"],
    grant_types_supported: [
      "authorization_code",
      "refresh_token",
      "client_credentials"
    ],
    token_endpoint_auth_methods_supported: [
      "client_secret_basic",
      "client_secret_post",
      "none"
    ],
    code_challenge_methods_supported: ["S256", "plain"],
    scopes_supported: ["openid", "email", "profile"]
  });
});

// Handle dynamic client registration
app.post("/register", (req, res) => {
  console.log("Client registration request:", req.body);

  // Extract client registration request
  const clientMetadata = req.body;

  // Generate a client_id and client_secret
  const client_id = `mock-client-${Date.now()}`;
  const client_secret = `mock-secret-${Math.random().toString(36).substring(7)}`;

  // Store the client
  registeredClients.set(client_id, {
    client_id,
    client_secret,
    ...clientMetadata
  });

  // Return the registered client info according to RFC 7591
  res.status(201).json({
    client_id,
    client_secret,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    client_secret_expires_at: 0, // Never expires
    ...clientMetadata
  });

  console.log(`Registered client: ${client_id}`);
});

// Forward all other requests to the OAuth2 server
app.use((req, res) => {
  oauth2Server.service.requestHandler(req, res);
});

// Start our Express server
const httpServer = http.createServer(app);
httpServer.listen(MOCK_OAUTH_PORT, MOCK_OAUTH_HOST, () => {
  console.log(`Mock OAuth2 Server running on ${issuerUrl}`);
  console.log("\nAvailable endpoints:");
  console.log(`  Authorization: ${issuerUrl}/authorize`);
  console.log(`  Token:         ${issuerUrl}/token`);
  console.log(`  Revocation:    ${issuerUrl}/revoke`);
  console.log(`  Registration:  ${issuerUrl}/register`);
  console.log(`  JWKS:          ${issuerUrl}/jwks`);
  console.log(`  Discovery:     ${issuerUrl}/.well-known/openid-configuration`);
  console.log(
    `  OAuth Server:  ${issuerUrl}/.well-known/oauth-authorization-server`
  );
  console.log("\nMock OAuth server ready with dynamic client registration");
});

// Handle graceful shutdown
const shutdown = async () => {
  console.log("\nShutting down mock OAuth server...");
  await oauth2Server.stop();
  httpServer.close(() => {
    console.log("Mock OAuth server stopped");
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
