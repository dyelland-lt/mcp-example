# OAuth Authentication Example

This document provides a complete example of using the OAuth 2.0 authentication flow with this MCP server.

## Overview

The OAuth implementation uses **Authorization Code Flow with PKCE** (Proof Key for Code Exchange), which is secure for both public and confidential clients.

## Flow Diagram

```
1. Configure OAuth → 2. Initiate Flow → 3. User Authorizes → 4. Complete Flow → 5. Authenticated Requests
```

## Step-by-Step Example

### Step 1: Configure OAuth

First, configure your OAuth provider settings:

```typescript
// Example configuration for a typical OAuth provider
{
  clientId: "your_app_client_id",
  clientSecret: "your_app_secret", // Optional for public clients
  authorizationUrl: "https://auth.example.com/oauth/authorize",
  tokenUrl: "https://auth.example.com/oauth/token",
  redirectUri: "http://localhost:3000/callback",
  resource: "https://mcp.example.com", // RFC 8707: Canonical URI of target MCP server
  scopes: ["read:graphql", "write:graphql"] // Optional (can be discovered from resource)
}
```

**New in MCP Spec Compliance:**
- `resource`: Canonical URI of the MCP server (REQUIRED per RFC 8707)
- `scopes`: Now optional - can be auto-discovered from Protected Resource Metadata

**Tool Call**: `oauth_configure`

### Step 2: Initiate OAuth Flow

Start the authorization flow:

**Tool Call**: `oauth_initiate`

**Response**:
```
OAuth flow initiated!

Please visit this URL to authorize:
https://auth.example.com/oauth/authorize?client_id=your_app_client_id&response_type=code&redirect_uri=http://localhost:3000/callback&state=abc123xyz...&code_challenge=xyz789...&code_challenge_method=S256

After authorization, you'll be redirected back with a code.
State: abc123xyz...
```

### Step 3: User Authorization

1. User visits the authorization URL
2. User logs in (if needed)
3. User grants permissions
4. User is redirected back to: `http://localhost:3000/callback?code=AUTH_CODE&state=abc123xyz...`

### Step 4: Complete OAuth Flow

Exchange the authorization code for tokens:

**Tool Call**: `oauth_complete`

```typescript
{
  code: "AUTH_CODE_FROM_REDIRECT",
  state: "abc123xyz..."
}
```

**Response**:
```
OAuth authentication successful!

Access token obtained and stored.
Token type: Bearer
Expires: 2025-11-21T15:30:00.000Z
Refresh token: Available
Scope: read:graphql write:graphql
```

### Step 5: Make Authenticated Requests

Now all GraphQL requests will automatically use the OAuth token:

**Tool Call**: `rick_and_morty_query` (or your custom GraphQL endpoint)

The server will:
- Automatically include the OAuth token in the Authorization header
- Refresh the token if it's expired (using refresh token)
- Prompt for re-authentication if refresh fails

### Check Authentication Status

**Tool Call**: `oauth_status`

**Response**:
```
OAuth Status:

Configured: Yes
Client ID: your_app_client_id
Redirect URI: http://localhost:3000/callback

Authenticated: Yes
Token Type: Bearer
Expires At: 2025-11-21T15:30:00.000Z
Refresh Token: Available
Scope: read:graphql write:graphql
```

### Logout

**Tool Call**: `oauth_logout`

**Response**:
```
Successfully logged out. OAuth tokens have been cleared.
```

## Security Features

### MCP Authorization Specification Compliance

This implementation follows the [MCP Authorization Specification](https://modelcontextprotocol.io/specification/draft/authorization):

#### Resource Parameter (RFC 8707)
- All authorization and token requests include the `resource` parameter
- Binds tokens to specific MCP servers (prevents token misuse across services)
- Example: `resource=https://mcp.example.com`

#### Discovery Mechanisms (RFC 9728, RFC 8414)
- **Protected Resource Metadata**: Discovers authorization servers from resource URLs
- **Authorization Server Metadata**: Discovers OAuth endpoints with multiple fallbacks
- **WWW-Authenticate Header Parsing**: Extracts resource_metadata URLs and scopes from 401/403 responses

#### PKCE (Proof Key for Code Exchange) with Verification
- Random 43-character code verifier generated at flow start
- SHA-256 code challenge sent in authorization request
- **Verification**: Checks `code_challenge_methods_supported` in server metadata
- **Compliance**: Refuses to proceed if PKCE S256 not supported

#### Scope Selection Strategy
Priority order per MCP spec:
1. Use `scope` from WWW-Authenticate header (if present)
2. Use all scopes from `scopes_supported` in Protected Resource Metadata
3. Omit scope parameter if undefined

#### Step-Up Authorization (Insufficient Scope Handling)
- Detects HTTP 403 with `insufficient_scope` error
- Parses required scopes from WWW-Authenticate header
- Can re-initiate authorization flow with additional scopes

#### Client ID Metadata Documents Support
- Supports using HTTPS URLs as `client_id`
- Validates metadata documents per draft-ietf-oauth-client-id-metadata-document-00
- Checks `client_id_metadata_document_supported` in server metadata

### State Parameter

- Random state value generated for each flow
- Prevents CSRF attacks
- Validated when completing the flow

### Token Refresh

- Automatically refreshes expired tokens
- Uses refresh token if available
- Includes resource parameter in refresh requests
- Prompts for re-authentication if refresh fails

### Token Expiration

- Tokens are checked before each request
- Considered expired if less than 5 minutes remaining
- Automatic refresh triggered when needed

### Transport Considerations

**Important**: This server uses STDIO transport for MCP communication. Per the MCP Authorization Specification:

> "Implementations using an STDIO transport **SHOULD NOT** follow this specification, and instead retrieve credentials from the environment."

The OAuth implementation provided here is for:
1. Educational/reference purposes
2. Scenarios where the MCP server acts as a client to external HTTP APIs (e.g., authenticated GraphQL queries)
3. Future HTTP-based transport implementations

For production STDIO-based MCP servers, consider retrieving credentials from environment variables or secure credential stores instead.

## Environment Variables

You can also configure basic authentication via environment variables (without OAuth):

```bash
export GRAPHQL_ENDPOINT="https://your-api.com/graphql"
export GRAPHQL_AUTH_TOKEN="your_static_token"
```

OAuth tokens take precedence over environment variable tokens.

## Switching APIs

The OAuth configuration is stored in memory and can be changed:

1. **Rick and Morty API** (default): No authentication needed
2. **Your GraphQL API**: Configure OAuth and authenticate
3. To switch back: Use `oauth_logout` and queries will work unauthenticated again

## Common Issues

### "OAuth not configured"
- Solution: Call `oauth_configure` first with your OAuth settings

### "No pending OAuth flow"
- Solution: Call `oauth_initiate` before `oauth_complete`

### "State mismatch"
- Possible CSRF attack detected
- Solution: Ensure you're using the state value from the same flow
- Start a new flow with `oauth_initiate` if needed

### "Token refresh failed"
- Solution: Call `oauth_initiate` again to re-authenticate

## Example: GitHub OAuth

```typescript
// Step 1: Configure
oauth_configure({
  clientId: "Iv1.your_github_client_id",
  clientSecret: "your_github_client_secret",
  authorizationUrl: "https://github.com/login/oauth/authorize",
  tokenUrl: "https://github.com/login/oauth/access_token",
  redirectUri: "http://localhost:3000/callback",
  scopes: ["read:user", "repo"]
})

// Step 2: Initiate
oauth_initiate()
// Visit the URL, authorize, get redirected with code

// Step 3: Complete
oauth_complete({
  code: "code_from_github",
  state: "state_from_initiate"
})

// Now authenticated!
```

## Advanced Usage: Discovery-Based Flow

The implementation supports automatic discovery per MCP spec:

### Automatic Authorization Server Discovery

Instead of manually configuring endpoints, you can use discovery:

```javascript
// 1. Start with just the resource URL
const resourceUrl = "https://mcp.example.com";

// 2. Discover authorization servers and scopes
const { authorizationServers, scopes } = await discoverAuthorizationFromResource(
  resourceUrl,
  wwwAuthenticateHeader // From 401 response, if available
);

// 3. Discover authorization server endpoints
const asMetadata = await discoverAuthorizationServerMetadata(authorizationServers[0]);

// 4. Verify PKCE support
validatePKCESupport(asMetadata);

// 5. Configure OAuth with discovered endpoints
oauth_configure({
  clientId: "your_client_id",
  authorizationUrl: asMetadata.authorization_endpoint,
  tokenUrl: asMetadata.token_endpoint,
  redirectUri: "http://localhost:3000/callback",
  resource: resourceUrl,
  scopes: scopes // Automatically discovered
});
```

### Client ID Metadata Documents

Use an HTTPS URL as your client_id:

```javascript
// Host your client metadata at this URL
const clientIdUrl = "https://app.example.com/oauth/client-metadata.json";

// Configure OAuth with URL-based client_id
oauth_configure({
  clientId: clientIdUrl, // HTTPS URL instead of opaque string
  authorizationUrl: asMetadata.authorization_endpoint,
  tokenUrl: asMetadata.token_endpoint,
  redirectUri: "http://localhost:3000/callback",
  resource: "https://mcp.example.com"
});

// The authorization server will fetch your metadata document
// No pre-registration needed!
```

### Handling Insufficient Scope Errors

When you receive a 403 error during runtime:

```javascript
// Server returns: HTTP 403 with WWW-Authenticate header
// WWW-Authenticate: Bearer error="insufficient_scope",
//                          scope="files:read files:write"

// 1. Parse the error
const insufficientScopeError = checkInsufficientScope(
  403,
  wwwAuthenticateHeader,
  currentTokenScopes
);

if (insufficientScopeError) {
  // 2. Determine new scopes to request
  const newScopes = determineScopesToRequest(
    insufficientScopeError.requiredScopes.join(' '),
    scopesSupported
  );

  // 3. Re-initiate auth flow with additional scopes
  // This is called "step-up authorization"
  oauth_initiate(); // Will request newScopes
}
```

## API Reference

### Discovery Functions

All discovery functions are exported from `oauth.ts`:

- `discoverAuthorizationFromResource(resourceUrl, wwwAuthenticateHeader?)` - Discovers authorization servers
- `discoverAuthorizationServerMetadata(issuerUrl)` - Discovers OAuth endpoints
- `validatePKCESupport(metadata)` - Checks PKCE S256 support
- `determineScopesToRequest(challengeScope?, scopesSupported?, configuredScopes?)` - Scope selection
- `checkInsufficientScope(statusCode, wwwAuthenticateHeader?, currentScopes?)` - Detects 403 insufficient_scope
- `supportsClientIdMetadata(metadata)` - Checks Client ID Metadata Document support
- `fetchClientIdMetadata(clientIdUrl)` - Fetches and validates client metadata

## Future Enhancements

Potential improvements for production use:

- Persistent token storage (filesystem, database, keychain)
- Multiple OAuth configurations (per-endpoint)
- Token encryption at rest
- Dynamic Client Registration (RFC 7591) support
- Device code flow for CLI tools
- Client credentials flow for server-to-server
- Automatic retry with step-up authorization on 403 errors
