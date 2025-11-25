#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMCPServer } from "./server.js";
import { tokenManager } from "./token-manager.js";
import { OAuthTokens } from "./oauth.js";

/**
 * Stdio MCP Server with OAuth Support
 *
 * This server loads OAuth credentials from environment variables
 * and uses them to authenticate requests to external APIs.
 *
 * Required environment variables for OAuth:
 * - OAUTH_ACCESS_TOKEN: Initial access token
 * - OAUTH_REFRESH_TOKEN: Refresh token (obtained with offline_access scope)
 * - OAUTH_TOKEN_URL: Token endpoint for refreshing tokens
 * - OAUTH_CLIENT_ID: OAuth client identifier
 * - OAUTH_CLIENT_SECRET: (Optional) Client secret if required
 * - OAUTH_RESOURCE: (Optional) Resource parameter for RFC 8707
 *
 * The server will automatically refresh tokens as needed using the refresh token.
 *
 * Usage:
 *   # Set environment variables
 *   export OAUTH_ACCESS_TOKEN="eyJhbGc..."
 *   export OAUTH_REFRESH_TOKEN="refresh-token-abc"
 *   export OAUTH_TOKEN_URL="http://localhost:4000/token"
 *   export OAUTH_CLIENT_ID="my-client-id"
 *
 *   # Run the server
 *   node build/stdio-server-with-oauth.js
 *
 * For Claude Desktop, add the env section to your config:
 * {
 *   "mcpServers": {
 *     "my-server": {
 *       "command": "node",
 *       "args": ["/path/to/build/stdio-server-with-oauth.js"],
 *       "env": {
 *         "OAUTH_ACCESS_TOKEN": "...",
 *         "OAUTH_REFRESH_TOKEN": "...",
 *         "OAUTH_TOKEN_URL": "...",
 *         "OAUTH_CLIENT_ID": "..."
 *       }
 *     }
 *   }
 * }
 */

async function main() {
  // Load OAuth configuration from environment
  const accessToken = process.env.OAUTH_ACCESS_TOKEN;
  const refreshToken = process.env.OAUTH_REFRESH_TOKEN;
  const tokenUrl = process.env.OAUTH_TOKEN_URL;
  const clientId = process.env.OAUTH_CLIENT_ID;
  const clientSecret = process.env.OAUTH_CLIENT_SECRET;
  const resource = process.env.OAUTH_RESOURCE;

  let oauthConfigured = false;

  if (accessToken && refreshToken && tokenUrl && clientId) {
    try {
      // Configure OAuth with credentials from environment
      tokenManager.setConfig({
        clientId,
        clientSecret,
        tokenUrl,
        authorizationUrl: "", // Not needed for refresh-only flow
        redirectUri: "", // Not needed for refresh-only flow
        resource, // Optional RFC 8707 resource parameter
      });

      // Set initial tokens
      const tokens: OAuthTokens = {
        accessToken,
        refreshToken,
        tokenType: "Bearer",
        // No expiry time provided - will be validated/refreshed on first use
      };
      tokenManager.setTokens(tokens);

      oauthConfigured = true;
      console.error("✓ OAuth credentials loaded from environment");
      console.error(`  Client ID: ${clientId.substring(0, 20)}...`);
      console.error(`  Token URL: ${tokenUrl}`);
      if (resource) {
        console.error(`  Resource: ${resource}`);
      }
    } catch (error) {
      console.error("✗ Failed to configure OAuth:", error);
      console.error("  Server will run without OAuth authentication");
    }
  } else {
    console.error("ℹ OAuth credentials not found in environment");
    console.error("  To enable OAuth, set the following environment variables:");
    console.error("  - OAUTH_ACCESS_TOKEN");
    console.error("  - OAUTH_REFRESH_TOKEN");
    console.error("  - OAUTH_TOKEN_URL");
    console.error("  - OAUTH_CLIENT_ID");
    console.error("  Server will run without OAuth authentication");
  }

  // Create the MCP server
  // OAuth is only disabled if credentials were not successfully configured
  const server = createMCPServer({
    disableOAuth: !oauthConfigured,
  });

  // Create stdio transport
  const transport = new StdioServerTransport();

  // Connect server to transport
  await server.connect(transport);

  console.error("MCP Stdio Server running");
  console.error(`OAuth: ${oauthConfigured ? "✓ enabled" : "✗ disabled"}`);
  console.error("Ready to accept connections via stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
