# MCP Authorization Specification Compliance

This document describes how this implementation complies with the [MCP Authorization Specification](https://modelcontextprotocol.io/specification/draft/authorization).

## Compliance Status: ✅ Fully Compliant

### Summary

This OAuth implementation includes all **REQUIRED** and **RECOMMENDED** features from the MCP Authorization Specification for OAuth 2.1-based authorization flows.

## Implemented Specifications

### Core OAuth 2.1 (Draft 13)
- ✅ Authorization Code Flow with PKCE
- ✅ Token refresh with automatic rotation
- ✅ Bearer token authentication
- ✅ State parameter for CSRF protection
- ✅ S256 code challenge method (REQUIRED)

### RFC 8707: Resource Indicators for OAuth 2.0
- ✅ `resource` parameter in authorization requests
- ✅ `resource` parameter in token requests
- ✅ `resource` parameter in refresh token requests
- ✅ Canonical URI format for resource identifiers

**Implementation**: See `oauth.ts` - `buildAuthorizationUrl()`, `exchangeCodeForToken()`, `refreshAccessToken()`

### RFC 9728: OAuth 2.0 Protected Resource Metadata
- ✅ WWW-Authenticate header parsing for `resource_metadata` URL
- ✅ Protected Resource Metadata document fetching
- ✅ Well-known URI discovery (with path and root fallbacks)
- ✅ `authorization_servers` field extraction
- ✅ `scopes_supported` field extraction
- ✅ `scope` parameter extraction from WWW-Authenticate challenges

**Implementation**: See `oauth.ts` - `parseWWWAuthenticateHeader()`, `fetchProtectedResourceMetadata()`, `discoverProtectedResourceMetadata()`, `discoverAuthorizationFromResource()`

### RFC 8414: OAuth 2.0 Authorization Server Metadata
- ✅ Authorization Server Metadata document fetching
- ✅ Multiple well-known endpoint discovery (path insertion, path appending)
- ✅ OAuth 2.0 Authorization Server Metadata (`.well-known/oauth-authorization-server`)
- ✅ OpenID Connect Discovery 1.0 (`.well-known/openid-configuration`)
- ✅ Issuer validation
- ✅ Required field validation (`issuer`, `authorization_endpoint`, `token_endpoint`, `response_types_supported`)

**Implementation**: See `oauth.ts` - `fetchAuthorizationServerMetadata()`, `discoverAuthorizationServerMetadata()`

### PKCE Verification (MCP Requirement)
- ✅ Check for `code_challenge_methods_supported` in authorization server metadata
- ✅ Verify `S256` is supported
- ✅ Refuse to proceed if PKCE not supported or only `plain` supported
- ✅ Clear error messages when PKCE unavailable

**Implementation**: See `oauth.ts` - `validatePKCESupport()`

### Scope Selection Strategy (MCP Specification)
- ✅ Priority 1: Use `scope` from WWW-Authenticate header (if present)
- ✅ Priority 2: Use all scopes from `scopes_supported` in Protected Resource Metadata
- ✅ Priority 3: Omit scope parameter if undefined
- ✅ Backward compatibility with manually configured scopes

**Implementation**: See `oauth.ts` - `determineScopesToRequest()`

### Insufficient Scope Handling (Step-Up Authorization)
- ✅ Detect HTTP 403 responses
- ✅ Parse `insufficient_scope` error from WWW-Authenticate header
- ✅ Extract required scopes from challenge
- ✅ Custom error class (`InsufficientScopeError`) for programmatic handling
- ✅ Support for re-initiating authorization with additional scopes

**Implementation**: See `oauth.ts` - `checkInsufficientScope()`, `InsufficientScopeError` class

### Client ID Metadata Documents (Draft 00)
- ✅ Detect HTTPS URL-formatted client_ids
- ✅ Fetch metadata documents from client_id URLs
- ✅ Validate required fields (`client_id`, `client_name`, `redirect_uris`)
- ✅ Validate client_id matches document URL
- ✅ Check `client_id_metadata_document_supported` in authorization server metadata

**Implementation**: See `oauth.ts` - `isClientIdMetadataUrl()`, `fetchClientIdMetadata()`, `supportsClientIdMetadata()`

## Security Compliance

### Token Security
- ✅ Tokens included in Authorization header (never in query string)
- ✅ Short-lived access tokens with refresh capability
- ✅ Token expiration checks (5-minute buffer)
- ✅ Secure random generation for PKCE verifiers (43 characters, base64url)
- ✅ SHA-256 hashing for code challenges

### Communication Security
- ✅ HTTPS required for all OAuth endpoints (enforced by URL validation)
- ✅ `localhost` or HTTPS required for redirect URIs (per OAuth 2.1)

### Authorization Code Protection
- ✅ PKCE with S256 (mandatory)
- ✅ State parameter validation (CSRF protection)
- ✅ Authorization code single-use (handled by authorization server)

## API Reference

### Configuration Interface
```typescript
interface OAuthConfig {
  clientId: string;              // Client identifier (can be HTTPS URL)
  clientSecret?: string;         // Optional for public clients
  authorizationUrl: string;      // Authorization endpoint
  tokenUrl: string;              // Token endpoint
  redirectUri: string;           // Redirect URI (localhost or HTTPS)
  scopes?: string[];             // Optional (can be auto-discovered)
  resource?: string;             // RFC 8707: Canonical MCP server URI
}
```

### Discovery Functions
```typescript
// Discover authorization servers from resource
discoverAuthorizationFromResource(
  resourceUrl: string,
  wwwAuthenticateHeader?: string
): Promise<{ authorizationServers: string[], scopes?: string[] }>

// Discover OAuth endpoints from authorization server
discoverAuthorizationServerMetadata(
  issuerUrl: string
): Promise<AuthorizationServerMetadata>

// Validate PKCE support
validatePKCESupport(
  metadata: AuthorizationServerMetadata
): void // Throws if not supported

// Determine scopes to request (follows MCP priority)
determineScopesToRequest(
  challengeScope?: string,
  scopesSupported?: string[],
  configuredScopes?: string[]
): string[] | undefined

// Check for insufficient scope errors
checkInsufficientScope(
  statusCode: number,
  wwwAuthenticateHeader?: string,
  currentScopes?: string[]
): InsufficientScopeError | null
```

### Client ID Metadata Documents
```typescript
// Check if client_id is metadata URL
isClientIdMetadataUrl(clientId: string): boolean

// Fetch and validate client metadata
fetchClientIdMetadata(
  clientIdUrl: string
): Promise<ClientIdMetadataDocument>

// Check server support
supportsClientIdMetadata(
  metadata: AuthorizationServerMetadata
): boolean
```

## Known Limitations

### Transport Consideration
This server uses **STDIO transport** for MCP communication. Per the MCP Authorization Specification:

> "Implementations using an STDIO transport **SHOULD NOT** follow this specification, and instead retrieve credentials from the environment."

The OAuth implementation is provided for:
1. Educational/reference purposes
2. External API authentication (e.g., GraphQL queries)
3. Future HTTP-based MCP transport implementations

### Not Implemented (Optional Features)
- ❌ Dynamic Client Registration (RFC 7591) - Optional per spec
- ❌ Device Authorization Grant (RFC 8628) - Not required for this use case
- ❌ Client Credentials Flow - Not applicable for user-delegated access
- ❌ JWT Bearer Token (RFC 9068) - Authorization server dependent
- ❌ Pushed Authorization Requests (RFC 9126) - Optional enhancement

### Server-Side Features (Authorization Server Responsibilities)
The following are authorization server responsibilities and not implemented here:
- Token audience validation
- Token introspection
- Token revocation
- Consent management
- Multi-factor authentication

## Testing Recommendations

To test MCP Authorization Specification compliance:

1. **Test Discovery Flow**
   ```bash
   # Try protected resource without authentication
   curl -i https://mcp.example.com/endpoint
   # Should return 401 with WWW-Authenticate header
   ```

2. **Test PKCE Verification**
   ```typescript
   // Should throw if authorization server lacks PKCE support
   try {
     await validatePKCESupport(serverMetadata);
   } catch (error) {
     console.log('Correctly rejected server without PKCE');
   }
   ```

3. **Test Resource Parameter**
   ```typescript
   // Verify resource parameter in authorization URL
   const authUrl = buildAuthorizationUrl(config, state, scopes);
   assert(authUrl.includes('resource=https%3A%2F%2Fmcp.example.com'));
   ```

4. **Test Insufficient Scope**
   ```bash
   # Make request with limited scope token
   curl -i -H "Authorization: Bearer LIMITED_TOKEN" \
     https://mcp.example.com/admin
   # Should return 403 with insufficient_scope error
   ```

5. **Test Client ID Metadata**
   ```typescript
   // Host metadata document at HTTPS URL
   const clientId = "https://app.example.com/client.json";
   const metadata = await fetchClientIdMetadata(clientId);
   assert(metadata.client_id === clientId);
   ```

## References

- [MCP Authorization Specification](https://modelcontextprotocol.io/specification/draft/authorization)
- [OAuth 2.1 (Draft 13)](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-13)
- [RFC 8707: Resource Indicators for OAuth 2.0](https://www.rfc-editor.org/rfc/rfc8707.html)
- [RFC 9728: OAuth 2.0 Protected Resource Metadata](https://datatracker.ietf.org/doc/html/rfc9728)
- [RFC 8414: OAuth 2.0 Authorization Server Metadata](https://datatracker.ietf.org/doc/html/rfc8414)
- [Client ID Metadata Documents (Draft 00)](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-client-id-metadata-document-00)
- [OpenID Connect Discovery 1.0](https://openid.net/specs/openid-connect-discovery-1_0.html)

## Changelog

### v1.1.0 - MCP Authorization Specification Compliance
- Added RFC 8707 resource parameter support
- Implemented RFC 9728 Protected Resource Metadata discovery
- Implemented RFC 8414 Authorization Server Metadata discovery
- Added PKCE verification requirement
- Implemented MCP scope selection strategy
- Added insufficient scope error handling
- Added Client ID Metadata Documents support
- Updated documentation with compliance details

### v1.0.0 - Initial Implementation
- Basic OAuth 2.1 Authorization Code Flow with PKCE
- Manual configuration of endpoints
- Token refresh capability
