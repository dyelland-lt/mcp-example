# Troubleshooting Guide

## OAuth "Unregistered redirect_uri" Error

### Problem

When calling `/oauth2/authorize`, you receive:
```json
{"error":"invalid_request","error_description":"Unregistered redirect_uri"}
```

### Root Cause

The `oauth2-mock-server` library validates redirect URIs by default. When you configure OAuth through the MCP tools and call `/authorize`, the mock OAuth server checks if the `redirect_uri` parameter matches a registered client.

### Solution

The mock OAuth server accepts any client_id and redirect_uri during development. You can use any values you like, or use these test values:

**Example Test Client:**
- **Client ID**: `test-client-id`
- **Client Secret**: `test-client-secret` (optional for PKCE)
- **Redirect URI**: `http://localhost:3000/callback` (or any URI you prefer)

### How to Use

When configuring OAuth through MCP tools:

```javascript
// Step 1: Configure OAuth
oauth_configure({
  clientId: "test-client-id",
  clientSecret: "test-client-secret",
  authorizationUrl: "http://localhost:3000/oauth2/authorize",
  tokenUrl: "http://localhost:3000/oauth2/token",
  redirectUri: "http://localhost:3000/callback",
  scopes: ["openid", "email", "profile"]
})// Step 2: Initiate OAuth flow
oauth_initiate()

// Step 3: Visit the authorization URL provided
// You'll be redirected to: http://localhost:3000/callback?code=...&state=...

// Step 4: Complete the OAuth flow
oauth_complete({
  code: "CODE_FROM_REDIRECT",
  state: "STATE_FROM_INITIATE"
})
```

### Testing with curl

You can test the `/authorize` endpoint directly:

```bash
curl -i "http://localhost:3000/oauth2/authorize?client_id=test-client-id&response_type=code&state=test123&redirect_uri=http://localhost:3000/callback"
```

Expected response:
```
HTTP/1.1 302 Found
Location: http://localhost:3000/callback?code=<AUTH_CODE>&state=test123
```

### Using Custom Redirect URIs

The mock OAuth server accepts any redirect URI during development. Simply use whatever URI your client expects:

```javascript
oauth_configure({
  clientId: "my-custom-client",
  authorizationUrl: "http://localhost:3000/oauth2/authorize",
  tokenUrl: "http://localhost:3000/oauth2/token",
  redirectUri: "http://localhost:8080/my-callback", // Any URI works
  scopes: ["openid", "email", "profile"]
})
```

#### Optional: Dynamic Client Registration

You can also register clients formally via the registration endpoint:

```bash
curl -X POST http://localhost:3000/oauth2/register \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "My Test Client",
    "redirect_uris": ["http://localhost:8080/callback"],
    "grant_types": ["authorization_code", "refresh_token"],
    "response_types": ["code"]
  }'
```

Response:
```json
{
  "client_id": "mock-client-1732219823456",
  "client_secret": "mock-secret-xyz789",
  "client_id_issued_at": 1732219823,
  "client_secret_expires_at": 0,
  ...
}
```

### Common OAuth Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Invalid redirectUri type` | Missing `redirect_uri` parameter | Always include `redirect_uri` in authorize requests |
| `State mismatch` | State parameter doesn't match | Use the exact state value from `oauth_initiate` |
| `Token exchange failed` | Invalid authorization code or PKCE verifier | Ensure you're using the code from the redirect and calling `oauth_complete` with the correct state |

### Server Startup Output

When the server starts successfully, you should see:

```
🔧 OAuth2 Server Configuration:
  Issuer URL: http://localhost:3000/oauth2
  Authorization Endpoint: http://localhost:3000/oauth2/authorize
  Token Endpoint: http://localhost:3000/oauth2/token
  Discovery: http://localhost:3000/oauth2/.well-known/oauth-authorization-server
🚀 Consolidated Server running on http://localhost:3000
```

### Debugging Tips

1. **Check server logs**: The server logs all authorization attempts
2. **Verify redirect_uri exactly**: Even trailing slashes matter (`/callback` vs `/callback/`)
3. **Check client_id**: Must exactly match `test-client-id` for the pre-registered client
4. **Use verbose curl**: Add `-v` flag to see full HTTP exchange
5. **Check PKCE parameters**: If using PKCE, ensure `code_challenge` and `code_challenge_method=S256` are included

### Architecture Notes

This server uses a **simplified architecture** for development/testing:

- **Mock OAuth Server**: Runs directly in the same Express app (not a separate service)
- **No Proxy Layer**: MCP clients connect directly to OAuth endpoints without SDK proxying
- **Permissive Validation**: Accepts any client_id and redirect_uri for easy testing

### Production Considerations

For production deployments:

1. **Use a real OAuth provider** - Auth0, Okta, Azure AD, GitHub, etc.
2. **Validate redirect URIs strictly** - Register allowed URIs in your OAuth provider's dashboard
3. **Use HTTPS** - Never use `http://` redirect URIs in production
4. **Implement proper client registration** - Pre-register clients or use dynamic registration (RFC 7591)
5. **Consider using MCP SDK's ProxyOAuthServerProvider** - For production, the proxy pattern adds useful middleware

### Related Documentation

- [OAUTH_EXAMPLE.md](./OAUTH_EXAMPLE.md) - Complete OAuth flow examples
- [HTTP_SERVER_GUIDE.md](./HTTP_SERVER_GUIDE.md) - HTTP server setup
- [MCP_COMPLIANCE.md](./MCP_COMPLIANCE.md) - MCP spec compliance details
