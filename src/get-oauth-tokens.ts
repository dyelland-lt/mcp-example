#!/usr/bin/env node

import http from "http";
import { createOAuthState, buildAuthorizationUrl, exchangeCodeForToken } from "./oauth.js";

/**
 * OAuth Token Acquisition Tool
 *
 * This script helps you obtain OAuth tokens (including refresh tokens with offline_access)
 * for use with the stdio MCP server.
 *
 * Usage:
 *   1. Start your OAuth server (e.g., npm run start:auth)
 *   2. Run this script: node build/get-oauth-tokens.js
 *   3. Follow the instructions to authorize in your browser
 *   4. Copy the environment variables that are printed
 *
 * Configuration:
 *   Edit the config object below or pass as command-line arguments
 */

interface TokenConfig {
  clientId: string;
  clientSecret?: string;
  authorizationUrl: string;
  tokenUrl: string;
  redirectUri: string;
  scopes: string[];
  resource?: string;
}

// Default configuration - customize for your OAuth provider
const defaultConfig: TokenConfig = {
  clientId: process.env.CLIENT_ID || "my-mcp-server",
  clientSecret: process.env.CLIENT_SECRET,
  authorizationUrl: process.env.AUTH_URL || "http://localhost:4000/authorize",
  tokenUrl: process.env.TOKEN_URL || "http://localhost:4000/token",
  redirectUri: process.env.REDIRECT_URI || "http://localhost:8888/callback",
  scopes: [
    "openid",
    "email",
    "profile",
    "offline_access", // This is the key - enables refresh tokens!
  ],
  resource: process.env.OAUTH_RESOURCE,
};

async function acquireTokens(config: TokenConfig): Promise<void> {
  console.log("\n" + "=".repeat(60));
  console.log("🔐 OAuth Token Acquisition Tool");
  console.log("=".repeat(60));
  console.log("\n📋 Configuration:");
  console.log(`  Client ID: ${config.clientId}`);
  console.log(`  Auth URL: ${config.authorizationUrl}`);
  console.log(`  Token URL: ${config.tokenUrl}`);
  console.log(`  Redirect URI: ${config.redirectUri}`);
  console.log(`  Scopes: ${config.scopes.join(", ")}`);
  if (config.resource) {
    console.log(`  Resource: ${config.resource}`);
  }

  // Generate PKCE values
  console.log("\n🔑 Generating PKCE values...");
  const oauthState = createOAuthState();
  console.log("  ✓ State:", oauthState.state);
  console.log("  ✓ Code verifier generated");
  console.log("  ✓ Code challenge generated");

  // Build authorization URL
  const authUrl = buildAuthorizationUrl(config, oauthState, config.scopes);

  console.log("\n🌐 Please visit this URL to authorize:\n");
  console.log(authUrl);
  console.log("\n");

  // Extract callback port from redirect URI
  const redirectUrl = new URL(config.redirectUri);
  const callbackPort = parseInt(redirectUrl.port);

  // Start temporary HTTP server to receive callback
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url!, `http://localhost:${callbackPort}`);

      if (url.pathname === redirectUrl.pathname || url.pathname === "/callback") {
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");
        const errorDescription = url.searchParams.get("error_description");

        // Handle OAuth errors
        if (error) {
          const message = `OAuth Error: ${error}${errorDescription ? ` - ${errorDescription}` : ""}`;
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end(`
            <html>
              <body>
                <h1>❌ Authorization Failed</h1>
                <p>${message}</p>
                <p>You can close this window.</p>
              </body>
            </html>
          `);
          console.error(`\n❌ ${message}`);
          server.close();
          reject(new Error(message));
          return;
        }

        // Validate state parameter
        if (state !== oauthState.state) {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end(`
            <html>
              <body>
                <h1>❌ State Mismatch</h1>
                <p>Possible CSRF attack detected. State parameter doesn't match.</p>
                <p>You can close this window.</p>
              </body>
            </html>
          `);
          console.error("\n❌ State mismatch - possible CSRF attack");
          server.close();
          reject(new Error("State mismatch"));
          return;
        }

        if (!code) {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end(`
            <html>
              <body>
                <h1>❌ No Authorization Code</h1>
                <p>No authorization code received.</p>
                <p>You can close this window.</p>
              </body>
            </html>
          `);
          console.error("\n❌ No authorization code received");
          server.close();
          reject(new Error("No authorization code"));
          return;
        }

        try {
          console.log("\n🔄 Exchanging authorization code for tokens...");

          const tokens = await exchangeCodeForToken(config, code, oauthState.codeVerifier);

          // Success response
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(`
            <html>
              <head>
                <style>
                  body { font-family: system-ui; max-width: 600px; margin: 50px auto; padding: 20px; }
                  h1 { color: #28a745; }
                  pre { background: #f6f8fa; padding: 15px; border-radius: 5px; overflow-x: auto; }
                </style>
              </head>
              <body>
                <h1>✅ Authorization Successful!</h1>
                <p>Tokens have been obtained. Check your terminal for the environment variables.</p>
                <p>You can close this window.</p>
              </body>
            </html>
          `);

          console.log("\n✅ Tokens obtained successfully!");
          console.log("\n📦 Token Info:");
          console.log(`  Token Type: ${tokens.tokenType}`);
          console.log(`  Access Token: ${tokens.accessToken.substring(0, 30)}...`);
          console.log(`  Refresh Token: ${tokens.refreshToken ? tokens.refreshToken.substring(0, 30) + "..." : "NOT PROVIDED"}`);
          if (tokens.expiresAt) {
            const expiresIn = Math.round((tokens.expiresAt - Date.now()) / 1000);
            console.log(`  Expires In: ${expiresIn} seconds`);
          }
          if (tokens.scope) {
            console.log(`  Scope: ${tokens.scope}`);
          }

          if (!tokens.refreshToken) {
            console.log("\n⚠️  WARNING: No refresh token received!");
            console.log("  Make sure 'offline_access' scope is supported by the OAuth provider");
            console.log("  and that it was included in the authorization request.");
          }

          console.log("\n📋 Environment Variables:\n");
          console.log("# Add these to your shell profile (~/.zshrc or ~/.bashrc)");
          console.log("# or to Claude Desktop config (env section):\n");
          console.log(`export OAUTH_ACCESS_TOKEN="${tokens.accessToken}"`);
          if (tokens.refreshToken) {
            console.log(`export OAUTH_REFRESH_TOKEN="${tokens.refreshToken}"`);
          }
          console.log(`export OAUTH_TOKEN_URL="${config.tokenUrl}"`);
          console.log(`export OAUTH_CLIENT_ID="${config.clientId}"`);
          if (config.clientSecret) {
            console.log(`export OAUTH_CLIENT_SECRET="${config.clientSecret}"`);
          }
          if (config.resource) {
            console.log(`export OAUTH_RESOURCE="${config.resource}"`);
          }

          console.log("\n" + "=".repeat(60));
          console.log("✅ Done!");
          console.log("=".repeat(60) + "\n");

          server.close();
          resolve();
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : "Unknown error";
          res.writeHead(500, { "Content-Type": "text/html" });
          res.end(`
            <html>
              <body>
                <h1>❌ Token Exchange Failed</h1>
                <p>${errorMsg}</p>
                <p>Check your terminal for details. You can close this window.</p>
              </body>
            </html>
          `);
          console.error(`\n❌ Token exchange failed: ${errorMsg}`);
          server.close();
          reject(error);
        }
      } else {
        // Not the callback path
        res.writeHead(404);
        res.end("Not found");
      }
    });

    server.listen(callbackPort, () => {
      console.log(`\n🔌 Callback server listening on ${config.redirectUri}`);
      console.log("⏳ Waiting for authorization...");
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      console.error("\n⏱️  Timeout: No authorization received within 5 minutes");
      server.close();
      reject(new Error("Authorization timeout"));
    }, 5 * 60 * 1000);
  });
}

// Parse command line arguments
function parseArgs(): Partial<TokenConfig> {
  const args = process.argv.slice(2);
  const parsed: Partial<TokenConfig> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case "--client-id":
        parsed.clientId = next;
        i++;
        break;
      case "--client-secret":
        parsed.clientSecret = next;
        i++;
        break;
      case "--auth-url":
        parsed.authorizationUrl = next;
        i++;
        break;
      case "--token-url":
        parsed.tokenUrl = next;
        i++;
        break;
      case "--redirect-uri":
        parsed.redirectUri = next;
        i++;
        break;
      case "--scopes":
        parsed.scopes = next.split(",");
        i++;
        break;
      case "--resource":
        parsed.resource = next;
        i++;
        break;
      case "--help":
      case "-h":
        console.log(`
OAuth Token Acquisition Tool

Usage:
  node build/get-oauth-tokens.js [options]

Options:
  --client-id <id>        OAuth client ID
  --client-secret <sec>   OAuth client secret (if required)
  --auth-url <url>        Authorization endpoint URL
  --token-url <url>       Token endpoint URL
  --redirect-uri <uri>    Redirect URI (default: http://localhost:8888/callback)
  --scopes <scopes>       Comma-separated list of scopes
  --resource <uri>        Resource parameter (RFC 8707)
  --help, -h              Show this help message

Environment Variables (used as defaults):
  CLIENT_ID, CLIENT_SECRET, AUTH_URL, TOKEN_URL, REDIRECT_URI, OAUTH_RESOURCE

Examples:
  # Use defaults (localhost:4000)
  node build/get-oauth-tokens.js

  # Custom OAuth provider
  node build/get-oauth-tokens.js \\
    --client-id "my-app" \\
    --auth-url "https://auth.example.com/authorize" \\
    --token-url "https://auth.example.com/token" \\
    --scopes "openid,email,offline_access"
        `);
        process.exit(0);
    }
  }

  return parsed;
}

async function main() {
  const cliArgs = parseArgs();
  const config = { ...defaultConfig, ...cliArgs };

  try {
    await acquireTokens(config);
  } catch (error) {
    console.error("\n❌ Failed to acquire tokens:", error);
    process.exit(1);
  }
}

main();
