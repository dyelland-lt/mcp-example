# Standalone OAuth2 Mock Server

This directory contains a standalone OAuth2 authorization server that can be run independently for testing and development purposes.

## Features

- ✅ **Authorization Code Flow with PKCE** (RFC 7636)
- ✅ **Token Refresh** with refresh tokens
- ✅ **Dynamic Client Registration** (RFC 7591)
- ✅ **OAuth Server Metadata** discovery (RFC 8414)
- ✅ **Protected Resource Metadata** discovery (RFC 9728)
- ✅ **OpenID Connect Discovery** 1.0
- ✅ **RS256 Signed JWTs** with rotating keys
- ✅ **Support for `offline_access` scope** for refresh tokens

## Running the Server

### Standalone Mode

Run the OAuth server on its own (default port 4000):

```bash
npm run build
npm run start:auth
```

Or with custom port:

```bash
PORT=5000 npm run start:auth
```

### Development Mode with Auto-Reload

```bash
npm run build
npm run dev:auth
```

### Integrated with MCP Server

The OAuth server can also run integrated with the main MCP HTTP server:

```bash
npm run start:http
```

In integrated mode, both the MCP server and OAuth server run on the same port (default 3000).

## Endpoints

Once running (assuming default port 4000):

### Core OAuth Endpoints
- **Authorization**: `http://localhost:4000/authorize`
- **Token**: `http://localhost:4000/token`
- **Revocation**: `http://localhost:4000/revoke`
- **Registration**: `http://localhost:4000/register`
- **JWKS**: `http://localhost:4000/jwks`

### Discovery Endpoints
- **OAuth Server Metadata**: `http://localhost:4000/.well-known/oauth-authorization-server`
- **OpenID Configuration**: `http://localhost:4000/.well-known/openid-configuration`
- **Protected Resource Metadata**: `http://localhost:4000/.well-known/oauth-protected-resource`

### Health Check
- **Health**: `http://localhost:4000/health`

## Usage Example

### 1. Register a Client (Optional)

```bash
curl -X POST http://localhost:4000/register \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "My MCP Client",
    "redirect_uris": ["http://localhost:3000/callback"],
    "grant_types": ["authorization_code", "refresh_token"],
    "token_endpoint_auth_method": "none"
  }'
```

Response:
```json
{
  "client_id": "mock-client-1234567890",
  "client_secret": "mock-secret-abc123",
  "client_id_issued_at": 1732550400,
  "client_secret_expires_at": 0
}
```

### 2. Start Authorization Flow

Build authorization URL with PKCE:

```
http://localhost:4000/authorize?
  client_id=mock-client-1234567890&
  response_type=code&
  redirect_uri=http://localhost:3000/callback&
  state=random-state-123&
  code_challenge=BASE64URL(SHA256(code_verifier))&
  code_challenge_method=S256&
  scope=openid email profile offline_access
```

**Note**: Include `offline_access` scope to receive a refresh token.

### 3. Exchange Authorization Code for Tokens

```bash
curl -X POST http://localhost:4000/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code" \
  -d "code=AUTHORIZATION_CODE" \
  -d "redirect_uri=http://localhost:3000/callback" \
  -d "client_id=mock-client-1234567890" \
  -d "code_verifier=ORIGINAL_CODE_VERIFIER"
```

Response:
```json
{
  "access_token": "eyJhbGc...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "mock-refresh-token-xyz",
  "scope": "openid email profile offline_access"
}
```

### 4. Refresh Access Token

```bash
curl -X POST http://localhost:4000/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=refresh_token" \
  -d "refresh_token=mock-refresh-token-xyz" \
  -d "client_id=mock-client-1234567890"
```

## Supported Scopes

- `openid` - OpenID Connect authentication
- `email` - Email address
- `profile` - User profile information
- `offline_access` - Refresh token for offline access

## Files

- **`index.ts`** - Standalone server entry point
- **`middleware.ts`** - OAuth2 middleware (can be embedded in other Express apps)
- **`README.md`** - This file

## Architecture

The OAuth server uses `oauth2-mock-server` under the hood, which provides:
- Fully compliant OAuth2 and OpenID Connect flows
- Real JWT signing with RSA keys
- In-memory session and token storage
- Automatic token validation

This is suitable for **development and testing only**. For production, use a proper authorization server like:
- Auth0
- Keycloak
- Azure AD
- AWS Cognito
- Okta

## Using with MCP Stdio Servers

For stdio MCP servers that need to authenticate with external APIs:

1. **Start the standalone auth server** on port 4000
2. **Configure your MCP server** to use the auth endpoints
3. **Obtain tokens** using the authorization code flow
4. **Store tokens securely** (e.g., in environment variables or credential store)
5. **Use refresh tokens** to maintain long-lived access with `offline_access` scope

This allows the MCP server itself to authenticate (server-to-server), not the end user.

## Next Steps

See the main project README for information about integrating OAuth authentication into your MCP server for making authenticated requests to external APIs.
