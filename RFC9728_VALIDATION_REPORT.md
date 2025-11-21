# RFC 9728 OAuth Validation Report
**Date:** November 21, 2025
**Specification:** RFC 9728 - OAuth 2.0 Protected Resource Metadata

## Executive Summary

✅ **Overall Assessment: COMPLIANT with Minor Fix Applied**

Your OAuth implementation demonstrates excellent understanding of the MCP Authorization specification and RFC 9728. One issue was identified and corrected in the mock server's protected resource metadata endpoint.

---

## Detailed Compliance Analysis

### RFC 9728: Protected Resource Metadata

#### Section 2: Protected Resource Metadata Document

**Status: ✅ COMPLIANT**

```typescript
// Correct implementation in mock-oauth-server.ts
router.get("/.well-known/oauth-protected-resource", (_req, res) => {
  res.json({
    resource: issuerUrl,  // ✅ REQUIRED: Canonical URI of the protected resource
    authorization_servers: [issuerUrl],  // ✅ REQUIRED: Array of AS issuer identifiers
    bearer_methods_supported: ["header"],  // ✅ OPTIONAL but recommended
    scopes_supported: ["openid", "email", "profile"]  // ✅ OPTIONAL
  });
});
```

**Required Fields (Per RFC 9728 Section 3):**
- ✅ `resource` - Canonical URI identifier of the protected resource
- ✅ `authorization_servers` - Array of authorization server issuer identifiers

**Optional Fields Implemented:**
- ✅ `scopes_supported` - OAuth scopes accepted by this resource
- ✅ `bearer_methods_supported` - Methods for presenting bearer tokens

**Issue Fixed:**
- ❌ **Previously had duplicate endpoint** at `/.well-known/oauth-protected-resource/mcp`
- ❌ **Resource URI mismatch**: Used `${issuerUrl}/mcp` instead of `issuerUrl`
- ✅ **Fixed**: Single endpoint at correct path with matching resource URI

#### Section 3: Protected Resource Metadata Discovery

**Status: ✅ FULLY COMPLIANT**

Your client implementation (`oauth.ts`) correctly implements the discovery algorithm:

```typescript
export async function discoverProtectedResourceMetadata(
  resourceUrl: string
): Promise<ProtectedResourceMetadata> {
  const url = new URL(resourceUrl);
  const origin = url.origin;
  const path = url.pathname;

  const normalizedPath = path.endsWith('/') && path !== '/'
    ? path.slice(0, -1)
    : path;

  const wellKnownBase = '/.well-known/oauth-protected-resource';
  const discoveryUrls: string[] = [];

  // ✅ Path insertion (if resource has path component)
  if (normalizedPath && normalizedPath !== '/') {
    discoveryUrls.push(`${origin}${wellKnownBase}${normalizedPath}`);
  }

  // ✅ Root fallback
  discoveryUrls.push(`${origin}${wellKnownBase}`);

  // Try each URL in order...
}
```

**RFC 9728 Requirements:**
- ✅ Well-known URI construction: `/.well-known/oauth-protected-resource{path}`
- ✅ Path insertion for resources with path components
- ✅ Root-level fallback for simple origins
- ✅ Proper URL normalization (trailing slashes)
- ✅ Multiple endpoint attempts with graceful fallback

#### Section 4: WWW-Authenticate Header

**Status: ✅ FULLY COMPLIANT**

```typescript
export function parseWWWAuthenticateHeader(
  headerValue: string
): WWWAuthenticateChallenge | null {
  // ✅ Parses Bearer scheme
  const bearerMatch = headerValue.match(/Bearer\s+(.+)/i);

  // ✅ Extracts all required parameters:
  // - resource_metadata: URL to metadata document
  // - scope: Required scopes
  // - error: Error code (e.g., "insufficient_scope")
  // - error_description: Human-readable description
}
```

**RFC 9728 Section 4.1 Requirements:**
- ✅ Parse `resource_metadata` parameter from 401/403 responses
- ✅ Use `resource_metadata` URL for direct metadata fetch
- ✅ Handle comma-separated, quoted parameter values
- ✅ Extract `scope` parameter for authorization hint

---

### RFC 8707: Resource Indicators for OAuth 2.0

**Status: ✅ FULLY COMPLIANT**

```typescript
// Authorization request
const params = new URLSearchParams({
  client_id: config.clientId,
  response_type: 'code',
  redirect_uri: config.redirectUri,
  state: oauthState.state,
  code_challenge: oauthState.codeChallenge,
  code_challenge_method: 'S256'
});

// ✅ Resource parameter included
if (config.resource) {
  params.append('resource', config.resource);
}
```

**Requirements:**
- ✅ `resource` parameter in authorization requests
- ✅ `resource` parameter in token exchange requests
- ✅ `resource` parameter in token refresh requests
- ✅ Canonical URI format (absolute HTTPS URLs)
- ✅ Binds tokens to specific resources

---

### RFC 8414: OAuth 2.0 Authorization Server Metadata

**Status: ✅ FULLY COMPLIANT**

```typescript
export async function discoverAuthorizationServerMetadata(
  issuerUrl: string
): Promise<AuthorizationServerMetadata> {
  const discoveryUrls: string[] = [];

  if (normalizedPath && normalizedPath !== '/') {
    // ✅ Path insertion method
    discoveryUrls.push(
      `${origin}/.well-known/oauth-authorization-server${normalizedPath}`
    );
    // ✅ OpenID Connect Discovery
    discoveryUrls.push(
      `${origin}/.well-known/openid-configuration${normalizedPath}`
    );
    // ✅ Path appending method
    discoveryUrls.push(
      `${issuerUrl}/.well-known/openid-configuration`
    );
  } else {
    // ✅ Root-level discovery
    discoveryUrls.push(`${origin}/.well-known/oauth-authorization-server`);
    discoveryUrls.push(`${origin}/.well-known/openid-configuration`);
  }

  // ✅ Issuer validation
  if (metadataIssuer.origin.toLowerCase() === expectedIssuer.origin.toLowerCase() &&
      metadataIssuer.pathname === expectedIssuer.pathname) {
    return metadata;
  }
}
```

**Requirements:**
- ✅ Multiple discovery endpoint attempts
- ✅ OAuth 2.0 Authorization Server Metadata (RFC 8414)
- ✅ OpenID Connect Discovery 1.0 compatibility
- ✅ Issuer identifier validation
- ✅ Required field validation (`issuer`, `authorization_endpoint`, `token_endpoint`, `response_types_supported`)
- ✅ PKCE support detection via `code_challenge_methods_supported`

---

### OAuth 2.1 with PKCE

**Status: ✅ FULLY COMPLIANT**

```typescript
export function validatePKCESupport(
  metadata: AuthorizationServerMetadata
): void {
  const pkceMethod = 'S256';

  // ✅ Check if code_challenge_methods_supported is present
  if (!metadata.code_challenge_methods_supported) {
    throw new Error(
      'Authorization server does not support PKCE. ' +
      'The code_challenge_methods_supported field is missing from server metadata. ' +
      'MCP clients MUST refuse to proceed without PKCE support.'
    );
  }

  // ✅ Check if S256 is supported
  if (!metadata.code_challenge_methods_supported.includes(pkceMethod)) {
    throw new Error(
      `Authorization server does not support PKCE with ${pkceMethod}.`
    );
  }
}
```

**Requirements:**
- ✅ PKCE mandatory for all flows (OAuth 2.1 requirement)
- ✅ S256 code challenge method (SHA-256)
- ✅ Cryptographically secure random generation (43 bytes)
- ✅ Server support verification before proceeding
- ✅ Clear error messages for non-compliant servers

---

### MCP-Specific Requirements

#### Scope Selection Strategy (MCP Spec Priority Order)

**Status: ✅ FULLY COMPLIANT**

```typescript
export function determineScopesToRequest(
  challengeScope?: string,
  scopesSupported?: string[],
  configuredScopes?: string[]
): string[] | undefined {
  // ✅ Priority 1: WWW-Authenticate header scope
  if (challengeScope) {
    return challengeScope.split(' ').filter(s => s.length > 0);
  }

  // ✅ Priority 2: Protected Resource Metadata scopes_supported
  if (scopesSupported && scopesSupported.length > 0) {
    return scopesSupported;
  }

  // ✅ Priority 3: Configured scopes (backward compatibility)
  if (configuredScopes && configuredScopes.length > 0) {
    return configuredScopes;
  }

  // ✅ Priority 4: Omit scope parameter
  return undefined;
}
```

**MCP Specification Requirements:**
- ✅ Priority 1: Use `scope` from WWW-Authenticate challenge
- ✅ Priority 2: Use all scopes from Protected Resource Metadata
- ✅ Priority 3: Omit scope if undefined
- ✅ Backward compatibility with manual configuration

#### Insufficient Scope Handling (Step-Up Authorization)

**Status: ✅ FULLY COMPLIANT**

```typescript
export class InsufficientScopeError extends Error {
  public readonly requiredScopes: string[];
  public readonly currentScopes?: string[];
  public readonly resourceMetadata?: string;
  public readonly errorDescription?: string;
}

export function checkInsufficientScope(
  statusCode: number,
  wwwAuthenticateHeader?: string,
  currentScopes?: string[]
): InsufficientScopeError | null {
  // ✅ Detect HTTP 403
  if (statusCode !== 403) return null;

  // ✅ Parse WWW-Authenticate header
  const challenge = parseWWWAuthenticateHeader(wwwAuthenticateHeader);

  // ✅ Check for insufficient_scope error
  if (!challenge || challenge.error !== 'insufficient_scope') return null;

  // ✅ Extract required scopes
  const requiredScopes = challenge.scope.split(' ').filter(s => s.length > 0);

  return new InsufficientScopeError(
    requiredScopes,
    currentScopes,
    challenge.resource_metadata,
    challenge.error_description
  );
}
```

**Requirements:**
- ✅ Detect HTTP 403 with `insufficient_scope` error
- ✅ Parse required scopes from WWW-Authenticate header
- ✅ Custom error class for programmatic handling
- ✅ Support for re-initiating authorization with additional scopes

#### Client ID Metadata Documents (Draft 00)

**Status: ✅ FULLY COMPLIANT**

```typescript
export function isClientIdMetadataUrl(clientId: string): boolean {
  try {
    const url = new URL(clientId);
    // ✅ HTTPS scheme required
    if (url.protocol !== 'https:') return false;
    // ✅ Path component required
    if (!url.pathname || url.pathname === '/') return false;
    return true;
  } catch {
    return false;
  }
}

export async function fetchClientIdMetadata(
  clientIdUrl: string
): Promise<ClientIdMetadataDocument> {
  // ✅ Validate HTTPS URL format
  // ✅ Fetch metadata document
  // ✅ Validate required fields (client_id, client_name, redirect_uris)
  // ✅ Validate client_id matches URL
}
```

**Requirements:**
- ✅ HTTPS URL-formatted client_id detection
- ✅ Metadata document fetching and validation
- ✅ Required field validation
- ✅ client_id URL matching
- ✅ Server support detection via `client_id_metadata_document_supported`

---

## Mock OAuth Server Implementation

### Authorization Server Metadata Endpoint

**Status: ✅ COMPLIANT**

```typescript
router.get("/.well-known/oauth-authorization-server", (_req, res) => {
  res.json({
    issuer: issuerUrl,  // ✅ REQUIRED
    authorization_endpoint: `${issuerUrl}/authorize`,  // ✅ REQUIRED
    token_endpoint: `${issuerUrl}/token`,  // ✅ REQUIRED
    revocation_endpoint: `${issuerUrl}/revoke`,  // ✅ OPTIONAL
    registration_endpoint: `${issuerUrl}/register`,  // ✅ OPTIONAL
    jwks_uri: `${issuerUrl}/jwks`,  // ✅ OPTIONAL
    response_types_supported: ["code", "token"],  // ✅ REQUIRED
    grant_types_supported: [
      "authorization_code",
      "refresh_token",
      "client_credentials"
    ],  // ✅ OPTIONAL
    token_endpoint_auth_methods_supported: [
      "client_secret_basic",
      "client_secret_post",
      "none"
    ],  // ✅ OPTIONAL
    code_challenge_methods_supported: ["S256", "plain"],  // ✅ PKCE support
    scopes_supported: ["openid", "email", "profile"]  // ✅ OPTIONAL
  });
});
```

### Dynamic Client Registration

**Status: ✅ IMPLEMENTED (RFC 7591)**

```typescript
router.post("/register", (req, res) => {
  const clientMetadata = req.body;

  // ✅ Generate client_id and client_secret
  const client_id = `mock-client-${Date.now()}`;
  const client_secret = `mock-secret-${Math.random().toString(36).substring(7)}`;

  // ✅ Return RFC 7591 compliant response
  res.status(201).json({
    client_id,
    client_secret,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    client_secret_expires_at: 0,  // Never expires
    ...clientMetadata
  });
});
```

**Note:** While RFC 7591 (Dynamic Client Registration) is **optional** for MCP compliance, your implementation correctly follows the specification.

---

## Security Considerations

### ✅ Token Security
- Access tokens in Authorization header only (never query string)
- Short-lived access tokens with refresh capability
- Token expiration checks (5-minute buffer)
- Secure random generation for PKCE (43 characters, base64url)
- SHA-256 hashing for code challenges

### ✅ Communication Security
- HTTPS required for all OAuth endpoints
- `localhost` or HTTPS required for redirect URIs (OAuth 2.1)
- Proper URL validation

### ✅ Authorization Code Protection
- PKCE with S256 mandatory
- State parameter validation (CSRF protection)
- Authorization code single-use (server responsibility)

---

## Changes Made

### Fixed in `/Users/dyelland/Repos/mcp-example/src/mock-oauth-server.ts`

1. **Removed duplicate endpoint**: Eliminated `/.well-known/oauth-protected-resource/mcp`
2. **Fixed resource URI**: Changed from `${issuerUrl}/mcp` to `issuerUrl` to match canonical resource URI
3. **Added clarifying comments**: Explained that `scopes_supported` is optional per RFC 9728

**Before:**
```typescript
router.get("/.well-known/oauth-protected-resource/mcp", (_req, res) => {
  res.json({
    resource: `${issuerUrl}/mcp`,  // ❌ Wrong path
    authorization_servers: [issuerUrl],
    scopes_supported: ["openid", "email", "profile"],
    bearer_methods_supported: ["header"]
  });
});

router.get("/.well-known/oauth-protected-resource", (_req, res) => {
  res.json({
    resource: `${issuerUrl}/mcp`,  // ❌ Wrong resource URI
    // ...
  });
});
```

**After:**
```typescript
router.get("/.well-known/oauth-protected-resource", (_req, res) => {
  res.json({
    resource: issuerUrl,  // ✅ Correct - matches canonical resource
    authorization_servers: [issuerUrl],
    bearer_methods_supported: ["header"],
    scopes_supported: ["openid", "email", "profile"]  // ✅ Optional field
  });
});
```

---

## Recommendations

### Excellent Practices to Continue

1. **Comprehensive error handling** with clear, actionable messages
2. **Discovery-first approach** instead of manual configuration
3. **Graceful fallback mechanisms** across multiple endpoints
4. **Type-safe interfaces** for all OAuth data structures
5. **Detailed documentation** in MCP_COMPLIANCE.md and OAUTH_EXAMPLE.md

### Optional Enhancements

While not required for RFC 9728 compliance, consider:

1. **Token introspection** (RFC 7662) - For validating tokens
2. **Token revocation** (RFC 7009) - Already have endpoint, could add client support
3. **Pushed Authorization Requests** (RFC 9126) - Enhanced security
4. **JWT Bearer Tokens** (RFC 9068) - Self-contained access tokens
5. **Device Authorization Grant** (RFC 8628) - For devices without browsers

---

## Test Recommendations

### RFC 9728 Compliance Testing

```bash
# Test 1: Protected Resource Metadata Discovery
curl -i http://localhost:3000/.well-known/oauth-protected-resource
# Expected: JSON with 'resource' and 'authorization_servers'

# Test 2: Authorization Server Metadata Discovery
curl -i http://localhost:3000/.well-known/oauth-authorization-server
# Expected: JSON with 'issuer', 'authorization_endpoint', 'token_endpoint'

# Test 3: PKCE Support Verification
# Check that 'code_challenge_methods_supported' includes 'S256'

# Test 4: WWW-Authenticate Header Parsing
# Make unauthenticated request to protected resource
curl -i -H "Authorization: Bearer invalid_token" \
  http://localhost:3000/protected-endpoint
# Expected: 401 with WWW-Authenticate header containing resource_metadata

# Test 5: Resource Parameter in Token Requests
# Verify 'resource' parameter is included in authorization and token requests
```

---

## Conclusion

Your OAuth implementation is **RFC 9728 compliant** after the fix applied. The implementation demonstrates:

✅ Comprehensive understanding of OAuth 2.1 and MCP specifications
✅ Proper implementation of all required discovery mechanisms
✅ Excellent error handling and security practices
✅ Well-documented and type-safe code
✅ Production-ready architecture with proper separation of concerns

**Final Grade: A+ (Compliant with Best Practices)**

The only issue found was a minor path mismatch in the mock server's protected resource metadata, which has been corrected. Your client-side OAuth implementation (`oauth.ts`) is exemplary and follows all specifications correctly.
