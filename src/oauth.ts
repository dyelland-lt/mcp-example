/**
 * OAuth 2.0 Flow Implementation
 *
 * Supports:
 * - Authorization Code Flow with PKCE
 * - Token storage and refresh
 * - Automatic token injection for GraphQL requests
 * - Protected Resource Metadata discovery (RFC 9728)
 * - Authorization Server Metadata discovery (RFC 8414)
 */

import crypto from 'crypto';

export interface OAuthConfig {
  clientId: string;
  clientSecret?: string;
  authorizationUrl: string;
  tokenUrl: string;
  redirectUri: string;
  scopes?: string[];
  resource?: string; // RFC 8707: Canonical URI of the target MCP server
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  tokenType: string;
  scope?: string;
}

export interface OAuthState {
  state: string;
  codeVerifier: string;
  codeChallenge: string;
  timestamp: number;
}

/**
 * RFC 9728: Protected Resource Metadata
 */
export interface ProtectedResourceMetadata {
  resource: string; // Canonical URI of the protected resource
  authorization_servers: string[]; // Authorization server issuer identifiers
  scopes_supported?: string[]; // List of supported scopes
  bearer_methods_supported?: string[]; // e.g., ["header", "body", "query"]
  resource_signing_alg_values_supported?: string[];
  resource_encryption_alg_values_supported?: string[];
  resource_encryption_enc_values_supported?: string[];
}

/**
 * Parsed WWW-Authenticate header parameters
 */
export interface WWWAuthenticateChallenge {
  scheme: string; // e.g., "Bearer"
  resource_metadata?: string; // URL to Protected Resource Metadata
  scope?: string; // Required scopes for the resource
  error?: string; // Error code (e.g., "insufficient_scope")
  error_description?: string; // Human-readable error description
}

/**
 * RFC 8414: OAuth 2.0 Authorization Server Metadata
 * RFC 8414 Section 2: Authorization Server Metadata
 */
export interface AuthorizationServerMetadata {
  issuer: string; // Authorization server's issuer identifier
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri?: string;
  registration_endpoint?: string;
  scopes_supported?: string[];
  response_types_supported: string[];
  grant_types_supported?: string[];
  token_endpoint_auth_methods_supported?: string[];
  code_challenge_methods_supported?: string[]; // PKCE methods (e.g., ["S256"])
  client_id_metadata_document_supported?: boolean; // Client ID Metadata Documents support
  // Additional fields omitted for brevity
  [key: string]: any;
}

/**
 * Generates cryptographically secure random string for PKCE
 */
export function generateRandomString(length: number = 43): string {
  return crypto.randomBytes(length)
    .toString('base64url')
    .slice(0, length);
}

/**
 * Generates PKCE code challenge from verifier
 */
export function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256')
    .update(verifier)
    .digest('base64url');
}

/**
 * Creates OAuth state for PKCE flow
 */
export function createOAuthState(): OAuthState {
  const state = generateRandomString();
  const codeVerifier = generateRandomString();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  return {
    state,
    codeVerifier,
    codeChallenge,
    timestamp: Date.now()
  };
}

/**
 * Validates that the authorization server supports PKCE with S256
 * Per MCP spec: clients MUST verify PKCE support and refuse to proceed if not supported
 */
export function validatePKCESupport(metadata: AuthorizationServerMetadata): void {
  const pkceMethod = 'S256';

  // Check if code_challenge_methods_supported is present
  if (!metadata.code_challenge_methods_supported) {
    throw new Error(
      'Authorization server does not support PKCE. ' +
      'The code_challenge_methods_supported field is missing from server metadata. ' +
      'MCP clients MUST refuse to proceed without PKCE support.'
    );
  }

  // Check if S256 is supported
  if (!metadata.code_challenge_methods_supported.includes(pkceMethod)) {
    throw new Error(
      `Authorization server does not support PKCE with ${pkceMethod}. ` +
      `Supported methods: ${metadata.code_challenge_methods_supported.join(', ')}. ` +
      'MCP clients MUST use S256 when technically capable.'
    );
  }
}

/**
 * Determines scopes to request following MCP scope selection strategy
 * Priority order per spec:
 * 1. Use 'scope' parameter from WWW-Authenticate header if provided
 * 2. Use all scopes from 'scopes_supported' in Protected Resource Metadata
 * 3. Omit scope parameter if scopes_supported is undefined
 *
 * @param challengeScope - Scope string from WWW-Authenticate header (if any)
 * @param scopesSupported - Array of supported scopes from Protected Resource Metadata
 * @param configuredScopes - Manually configured scopes from OAuthConfig (for backward compatibility)
 * @returns Array of scopes to request, or undefined if no scopes should be requested
 */
export function determineScopesToRequest(
  challengeScope?: string,
  scopesSupported?: string[],
  configuredScopes?: string[]
): string[] | undefined {
  // Priority 1: Use scope from WWW-Authenticate challenge
  if (challengeScope) {
    return challengeScope.split(' ').filter(s => s.length > 0);
  }

  // Priority 2: Use scopes_supported from Protected Resource Metadata
  if (scopesSupported && scopesSupported.length > 0) {
    return scopesSupported;
  }

  // Backward compatibility: Use manually configured scopes
  if (configuredScopes && configuredScopes.length > 0) {
    return configuredScopes;
  }

  // Priority 3: Omit scope parameter (undefined)
  return undefined;
}

/**
 * Client ID Metadata Document (draft-ietf-oauth-client-id-metadata-document-00)
 */
export interface ClientIdMetadataDocument {
  client_id: string; // Must match the HTTPS URL hosting the document
  client_name: string;
  client_uri?: string;
  logo_uri?: string;
  redirect_uris: string[];
  grant_types?: string[];
  response_types?: string[];
  token_endpoint_auth_method?: string; // e.g., "none" for public clients, "private_key_jwt"
  jwks_uri?: string;
  jwks?: any;
  scope?: string;
  contacts?: string[];
  tos_uri?: string;
  policy_uri?: string;
  [key: string]: any;
}

/**
 * Validates that a client_id is an HTTPS URL suitable for Client ID Metadata Documents
 */
export function isClientIdMetadataUrl(clientId: string): boolean {
  try {
    const url = new URL(clientId);
    // Must use https scheme
    if (url.protocol !== 'https:') {
      return false;
    }
    // Must contain a path component
    if (!url.pathname || url.pathname === '/') {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Fetches and validates Client ID Metadata Document from HTTPS URL
 * Per spec: Authorization servers fetch this when client_id is an HTTPS URL
 */
export async function fetchClientIdMetadata(
  clientIdUrl: string
): Promise<ClientIdMetadataDocument> {
  if (!isClientIdMetadataUrl(clientIdUrl)) {
    throw new Error(
      'Invalid client_id for metadata document: must be HTTPS URL with path component'
    );
  }

  const response = await fetch(clientIdUrl, {
    method: 'GET',
    headers: {
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch Client ID Metadata: ${response.status} ${response.statusText}`
    );
  }

  const metadata = await response.json();

  // Validate required fields
  if (!metadata.client_id || !metadata.client_name || !metadata.redirect_uris) {
    throw new Error(
      'Invalid Client ID Metadata Document: missing required fields (client_id, client_name, redirect_uris)'
    );
  }

  if (!Array.isArray(metadata.redirect_uris) || metadata.redirect_uris.length === 0) {
    throw new Error('Invalid Client ID Metadata Document: redirect_uris must be non-empty array');
  }

  // Validate that client_id in document matches URL
  if (metadata.client_id !== clientIdUrl) {
    throw new Error(
      `Client ID mismatch: document client_id (${metadata.client_id}) ` +
      `does not match URL (${clientIdUrl})`
    );
  }

  return metadata as ClientIdMetadataDocument;
}

/**
 * Checks if authorization server supports Client ID Metadata Documents
 */
export function supportsClientIdMetadata(metadata: AuthorizationServerMetadata): boolean {
  return metadata.client_id_metadata_document_supported === true;
}

/**
 * Error class for insufficient scope errors (HTTP 403)
 * Used to trigger step-up authorization flow
 */
export class InsufficientScopeError extends Error {
  public readonly requiredScopes: string[];
  public readonly currentScopes?: string[];
  public readonly resourceMetadata?: string;
  public readonly errorDescription?: string;

  constructor(
    requiredScopes: string[],
    currentScopes?: string[],
    resourceMetadata?: string,
    errorDescription?: string
  ) {
    super(
      `Insufficient scope. Required scopes: ${requiredScopes.join(' ')}. ` +
      `Current scopes: ${currentScopes?.join(' ') || 'none'}. ` +
      `${errorDescription || ''}`
    );
    this.name = 'InsufficientScopeError';
    this.requiredScopes = requiredScopes;
    this.currentScopes = currentScopes;
    this.resourceMetadata = resourceMetadata;
    this.errorDescription = errorDescription;
  }
}

/**
 * Checks if an HTTP response indicates insufficient scope (403)
 * and parses the required scopes from WWW-Authenticate header
 */
export function checkInsufficientScope(
  statusCode: number,
  wwwAuthenticateHeader?: string,
  currentScopes?: string[]
): InsufficientScopeError | null {
  if (statusCode !== 403) {
    return null;
  }

  if (!wwwAuthenticateHeader) {
    return null;
  }

  const challenge = parseWWWAuthenticateHeader(wwwAuthenticateHeader);

  if (!challenge || challenge.error !== 'insufficient_scope') {
    return null;
  }

  if (!challenge.scope) {
    // Error is insufficient_scope but no scopes specified
    return null;
  }

  const requiredScopes = challenge.scope.split(' ').filter(s => s.length > 0);

  return new InsufficientScopeError(
    requiredScopes,
    currentScopes,
    challenge.resource_metadata,
    challenge.error_description
  );
}

/**
 * Builds authorization URL for OAuth flow
 * Note: This function does not validate PKCE support - caller must do that first
 *
 * @param config - OAuth configuration
 * @param oauthState - PKCE state with code challenge
 * @param scopes - Scopes to request (if undefined, scope parameter is omitted)
 */
export function buildAuthorizationUrl(
  config: OAuthConfig,
  oauthState: OAuthState,
  scopes?: string[]
): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    redirect_uri: config.redirectUri,
    state: oauthState.state,
    code_challenge: oauthState.codeChallenge,
    code_challenge_method: 'S256'
  });

  // Only include scope if scopes are defined (following MCP spec)
  if (scopes && scopes.length > 0) {
    params.append('scope', scopes.join(' '));
  }

  // RFC 8707: Resource parameter MUST be included
  if (config.resource) {
    params.append('resource', config.resource);
  }

  return `${config.authorizationUrl}?${params.toString()}`;
}

/**
 * Exchanges authorization code for access token
 */
export async function exchangeCodeForToken(
  config: OAuthConfig,
  code: string,
  codeVerifier: string
): Promise<OAuthTokens> {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
    code_verifier: codeVerifier
  });

  if (config.clientSecret) {
    params.append('client_secret', config.clientSecret);
  }

  // RFC 8707: Resource parameter MUST be included
  if (config.resource) {
    params.append('resource', config.resource);
  }

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_in ? Date.now() + (data.expires_in * 1000) : undefined,
    tokenType: data.token_type || 'Bearer',
    scope: data.scope
  };
}

/**
 * Refreshes an expired access token
 */
export async function refreshAccessToken(
  config: OAuthConfig,
  refreshToken: string
): Promise<OAuthTokens> {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: config.clientId
  });

  if (config.clientSecret) {
    params.append('client_secret', config.clientSecret);
  }

  // RFC 8707: Resource parameter should be included in refresh requests
  if (config.resource) {
    params.append('resource', config.resource);
  }

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${error}`);
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt: data.expires_in ? Date.now() + (data.expires_in * 1000) : undefined,
    tokenType: data.token_type || 'Bearer',
    scope: data.scope
  };
}

/**
 * Checks if token is expired or about to expire (within 5 minutes)
 */
export function isTokenExpired(tokens: OAuthTokens | null): boolean {
  if (!tokens || !tokens.expiresAt) {
    return true;
  }
  // Consider expired if less than 5 minutes remaining
  return Date.now() >= (tokens.expiresAt - 5 * 60 * 1000);
}

/**
 * RFC 9728: Parses WWW-Authenticate header from 401/403 responses
 * Extracts Bearer challenge parameters including resource_metadata URL and scope
 */
export function parseWWWAuthenticateHeader(headerValue: string): WWWAuthenticateChallenge | null {
  if (!headerValue) return null;

  // Match Bearer scheme
  const bearerMatch = headerValue.match(/Bearer\s+(.+)/i);
  if (!bearerMatch) return null;

  const challenge: WWWAuthenticateChallenge = { scheme: 'Bearer' };
  const params = bearerMatch[1];

  // Parse comma-separated key=value pairs, handling quoted values
  const paramRegex = /(\w+)=(?:"([^"]*)"|([^\s,]+))/g;
  let match;

  while ((match = paramRegex.exec(params)) !== null) {
    const key = match[1];
    const value = match[2] || match[3]; // Quoted or unquoted value

    switch (key.toLowerCase()) {
      case 'resource_metadata':
        challenge.resource_metadata = value;
        break;
      case 'scope':
        challenge.scope = value;
        break;
      case 'error':
        challenge.error = value;
        break;
      case 'error_description':
        challenge.error_description = value;
        break;
    }
  }

  return challenge;
}

/**
 * RFC 9728: Fetches Protected Resource Metadata from a given URL
 */
export async function fetchProtectedResourceMetadata(
  metadataUrl: string
): Promise<ProtectedResourceMetadata> {
  const response = await fetch(metadataUrl, {
    method: 'GET',
    headers: {
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Protected Resource Metadata: ${response.status} ${response.statusText}`);
  }

  const metadata = await response.json();

  // Validate required fields
  if (!metadata.resource || !metadata.authorization_servers || !Array.isArray(metadata.authorization_servers)) {
    throw new Error('Invalid Protected Resource Metadata: missing required fields');
  }

  if (metadata.authorization_servers.length === 0) {
    throw new Error('Invalid Protected Resource Metadata: no authorization servers listed');
  }

  return metadata as ProtectedResourceMetadata;
}

/**
 * RFC 9728: Discovers Protected Resource Metadata using well-known URIs
 * Tries multiple discovery endpoints in priority order
 */
export async function discoverProtectedResourceMetadata(
  resourceUrl: string
): Promise<ProtectedResourceMetadata> {
  const url = new URL(resourceUrl);
  const origin = url.origin;
  const path = url.pathname;

  // Remove trailing slash for consistency
  const normalizedPath = path.endsWith('/') && path !== '/' ? path.slice(0, -1) : path;

  const wellKnownBase = '/.well-known/oauth-protected-resource';
  const discoveryUrls: string[] = [];

  // If resource has a path component, try path insertion first
  if (normalizedPath && normalizedPath !== '/') {
    discoveryUrls.push(`${origin}${wellKnownBase}${normalizedPath}`);
  }

  // Always try root well-known URI as fallback
  discoveryUrls.push(`${origin}${wellKnownBase}`);

  let lastError: Error | null = null;

  for (const discoveryUrl of discoveryUrls) {
    try {
      return await fetchProtectedResourceMetadata(discoveryUrl);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      // Continue to next URL
    }
  }

  throw new Error(
    `Failed to discover Protected Resource Metadata for ${resourceUrl}. ` +
    `Tried: ${discoveryUrls.join(', ')}. Last error: ${lastError?.message}`
  );
}

/**
 * Discovers authorization server and scopes from a 401 response or resource URL
 * Returns authorization server URLs and recommended scopes
 */
export async function discoverAuthorizationFromResource(
  resourceUrl: string,
  wwwAuthenticateHeader?: string
): Promise<{ authorizationServers: string[]; scopes?: string[] }> {
  let metadataUrl: string | undefined;
  let challengedScopes: string | undefined;

  // First, check WWW-Authenticate header for resource_metadata URL
  if (wwwAuthenticateHeader) {
    const challenge = parseWWWAuthenticateHeader(wwwAuthenticateHeader);
    metadataUrl = challenge?.resource_metadata;
    challengedScopes = challenge?.scope;
  }

  let metadata: ProtectedResourceMetadata;

  if (metadataUrl) {
    // Use metadata URL from WWW-Authenticate header
    metadata = await fetchProtectedResourceMetadata(metadataUrl);
  } else {
    // Fall back to well-known URI discovery
    metadata = await discoverProtectedResourceMetadata(resourceUrl);
  }

  return {
    authorizationServers: metadata.authorization_servers,
    scopes: challengedScopes ? challengedScopes.split(' ') : metadata.scopes_supported
  };
}

/**
 * RFC 8414: Fetches Authorization Server Metadata from a well-known endpoint
 */
export async function fetchAuthorizationServerMetadata(
  metadataUrl: string
): Promise<AuthorizationServerMetadata> {
  const response = await fetch(metadataUrl, {
    method: 'GET',
    headers: {
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Authorization Server Metadata: ${response.status} ${response.statusText}`);
  }

  const metadata = await response.json();

  // Validate required fields per RFC 8414 Section 2
  if (!metadata.issuer || !metadata.authorization_endpoint || !metadata.token_endpoint) {
    throw new Error('Invalid Authorization Server Metadata: missing required fields');
  }

  if (!Array.isArray(metadata.response_types_supported) || metadata.response_types_supported.length === 0) {
    throw new Error('Invalid Authorization Server Metadata: response_types_supported is required');
  }

  return metadata as AuthorizationServerMetadata;
}

/**
 * RFC 8414 + OpenID Connect Discovery: Discovers Authorization Server Metadata
 * Tries multiple well-known endpoints in priority order based on issuer URL format
 */
export async function discoverAuthorizationServerMetadata(
  issuerUrl: string
): Promise<AuthorizationServerMetadata> {
  const url = new URL(issuerUrl);
  const origin = url.origin;
  const path = url.pathname;

  // Remove trailing slash for consistency
  const normalizedPath = path.endsWith('/') && path !== '/' ? path.slice(0, -1) : path;

  const discoveryUrls: string[] = [];

  // For issuer URLs with path components (e.g., https://auth.example.com/tenant1)
  if (normalizedPath && normalizedPath !== '/') {
    // 1. OAuth 2.0 Authorization Server Metadata with path insertion
    discoveryUrls.push(`${origin}/.well-known/oauth-authorization-server${normalizedPath}`);
    // 2. OpenID Connect Discovery 1.0 with path insertion
    discoveryUrls.push(`${origin}/.well-known/openid-configuration${normalizedPath}`);
    // 3. OpenID Connect Discovery 1.0 path appending
    discoveryUrls.push(`${issuerUrl}/.well-known/openid-configuration`);
  } else {
    // For issuer URLs without path components (e.g., https://auth.example.com)
    // 1. OAuth 2.0 Authorization Server Metadata
    discoveryUrls.push(`${origin}/.well-known/oauth-authorization-server`);
    // 2. OpenID Connect Discovery 1.0
    discoveryUrls.push(`${origin}/.well-known/openid-configuration`);
  }

  let lastError: Error | null = null;

  for (const discoveryUrl of discoveryUrls) {
    try {
      const metadata = await fetchAuthorizationServerMetadata(discoveryUrl);

      // Validate that the issuer in metadata matches the expected issuer
      // (allowing for case-insensitive scheme/host per spec)
      const metadataIssuer = new URL(metadata.issuer);
      const expectedIssuer = new URL(issuerUrl);

      if (metadataIssuer.origin.toLowerCase() === expectedIssuer.origin.toLowerCase() &&
          metadataIssuer.pathname === expectedIssuer.pathname) {
        return metadata;
      }

      // If issuer doesn't match, continue to next discovery URL
      lastError = new Error(`Issuer mismatch: expected ${issuerUrl}, got ${metadata.issuer}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      // Continue to next URL
    }
  }

  throw new Error(
    `Failed to discover Authorization Server Metadata for ${issuerUrl}. ` +
    `Tried: ${discoveryUrls.join(', ')}. Last error: ${lastError?.message}`
  );
}
