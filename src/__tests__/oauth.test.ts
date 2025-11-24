import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateRandomString,
  generateCodeChallenge,
  createOAuthState,
  buildAuthorizationUrl,
  exchangeCodeForToken,
  refreshAccessToken,
  isTokenExpired,
  determineScopesToRequest,
  validatePKCESupport,
  parseWWWAuthenticateHeader,
  checkInsufficientScope,
  isClientIdMetadataUrl,
  type OAuthConfig,
  type OAuthTokens,
  type AuthorizationServerMetadata,
} from '../oauth.js';

describe('OAuth Utility Functions', () => {
  describe('generateRandomString', () => {
    it('should generate a random string of specified length', () => {
      const result = generateRandomString(32);
      expect(result).toHaveLength(32);
    });

    it('should generate different strings on each call', () => {
      const result1 = generateRandomString();
      const result2 = generateRandomString();
      expect(result1).not.toBe(result2);
    });

    it('should generate URL-safe base64 strings', () => {
      const result = generateRandomString(43);
      expect(result).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });

  describe('generateCodeChallenge', () => {
    it('should generate a SHA256 hash of the verifier', () => {
      const verifier = 'test-verifier';
      const challenge = generateCodeChallenge(verifier);
      expect(challenge).toBeTruthy();
      expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('should produce consistent results for same input', () => {
      const verifier = 'same-verifier';
      const challenge1 = generateCodeChallenge(verifier);
      const challenge2 = generateCodeChallenge(verifier);
      expect(challenge1).toBe(challenge2);
    });
  });

  describe('createOAuthState', () => {
    it('should create OAuth state with all required fields', () => {
      const state = createOAuthState();
      expect(state.state).toBeTruthy();
      expect(state.codeVerifier).toBeTruthy();
      expect(state.codeChallenge).toBeTruthy();
      expect(state.timestamp).toBeGreaterThan(0);
    });

    it('should generate different states on each call', () => {
      const state1 = createOAuthState();
      const state2 = createOAuthState();
      expect(state1.state).not.toBe(state2.state);
      expect(state1.codeVerifier).not.toBe(state2.codeVerifier);
    });

    it('should have valid PKCE challenge/verifier relationship', () => {
      const state = createOAuthState();
      const expectedChallenge = generateCodeChallenge(state.codeVerifier);
      expect(state.codeChallenge).toBe(expectedChallenge);
    });
  });

  describe('buildAuthorizationUrl', () => {
    const config: OAuthConfig = {
      clientId: 'test-client',
      authorizationUrl: 'https://auth.example.com/authorize',
      tokenUrl: 'https://auth.example.com/token',
      redirectUri: 'http://localhost:3000/callback',
    };

    it('should build a valid authorization URL with required parameters', () => {
      const state = createOAuthState();
      const url = buildAuthorizationUrl(config, state);

      expect(url).toContain('https://auth.example.com/authorize?');
      expect(url).toContain(`client_id=${config.clientId}`);
      expect(url).toContain(`redirect_uri=${encodeURIComponent(config.redirectUri)}`);
      expect(url).toContain(`state=${state.state}`);
      expect(url).toContain(`code_challenge=${state.codeChallenge}`);
      expect(url).toContain('code_challenge_method=S256');
      expect(url).toContain('response_type=code');
    });

    it('should include scopes when provided', () => {
      const state = createOAuthState();
      const scopes = ['read', 'write'];
      const url = buildAuthorizationUrl(config, state, scopes);

      expect(url).toContain('scope=read+write');
    });

    it('should omit scope parameter when scopes are undefined', () => {
      const state = createOAuthState();
      const url = buildAuthorizationUrl(config, state, undefined);

      expect(url).not.toContain('scope=');
    });

    it('should include resource parameter when provided', () => {
      const configWithResource = { ...config, resource: 'https://api.example.com' };
      const state = createOAuthState();
      const url = buildAuthorizationUrl(configWithResource, state);

      expect(url).toContain(`resource=${encodeURIComponent('https://api.example.com')}`);
    });
  });

  describe('exchangeCodeForToken', () => {
    const config: OAuthConfig = {
      clientId: 'test-client',
      authorizationUrl: 'https://auth.example.com/authorize',
      tokenUrl: 'https://auth.example.com/token',
      redirectUri: 'http://localhost:3000/callback',
    };

    beforeEach(() => {
      global.fetch = vi.fn();
    });

    it('should exchange authorization code for tokens', async () => {
      const mockResponse = {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const tokens = await exchangeCodeForToken(config, 'auth-code', 'code-verifier');

      expect(tokens.accessToken).toBe('test-access-token');
      expect(tokens.refreshToken).toBe('test-refresh-token');
      expect(tokens.tokenType).toBe('Bearer');
      expect(tokens.expiresAt).toBeGreaterThan(Date.now());
    });

    it('should include client secret if provided', async () => {
      const configWithSecret = { ...config, clientSecret: 'secret' };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token', token_type: 'Bearer' }),
      });

      await exchangeCodeForToken(configWithSecret, 'code', 'verifier');

      const call = (global.fetch as any).mock.calls[0];
      const body = call[1].body;
      expect(body).toContain('client_secret=secret');
    });

    it('should include resource parameter if provided', async () => {
      const configWithResource = { ...config, resource: 'https://api.example.com' };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token', token_type: 'Bearer' }),
      });

      await exchangeCodeForToken(configWithResource, 'code', 'verifier');

      const call = (global.fetch as any).mock.calls[0];
      const body = call[1].body;
      expect(body).toContain(`resource=${encodeURIComponent('https://api.example.com')}`);
    });

    it('should throw error on failed token exchange', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        text: async () => 'Invalid grant',
      });

      await expect(
        exchangeCodeForToken(config, 'invalid-code', 'verifier')
      ).rejects.toThrow('Token exchange failed');
    });
  });

  describe('refreshAccessToken', () => {
    const config: OAuthConfig = {
      clientId: 'test-client',
      authorizationUrl: 'https://auth.example.com/authorize',
      tokenUrl: 'https://auth.example.com/token',
      redirectUri: 'http://localhost:3000/callback',
    };

    beforeEach(() => {
      global.fetch = vi.fn();
    });

    it('should refresh access token', async () => {
      const mockResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const tokens = await refreshAccessToken(config, 'old-refresh-token');

      expect(tokens.accessToken).toBe('new-access-token');
      expect(tokens.refreshToken).toBe('new-refresh-token');
    });

    it('should preserve old refresh token if not returned', async () => {
      const mockResponse = {
        access_token: 'new-access-token',
        expires_in: 3600,
        token_type: 'Bearer',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const tokens = await refreshAccessToken(config, 'old-refresh-token');

      expect(tokens.refreshToken).toBe('old-refresh-token');
    });

    it('should throw error on failed refresh', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        text: async () => 'Invalid refresh token',
      });

      await expect(
        refreshAccessToken(config, 'invalid-token')
      ).rejects.toThrow('Token refresh failed');
    });
  });

  describe('isTokenExpired', () => {
    it('should return true for null tokens', () => {
      expect(isTokenExpired(null)).toBe(true);
    });

    it('should return true for tokens without expiry', () => {
      const tokens: OAuthTokens = {
        accessToken: 'token',
        tokenType: 'Bearer',
      };
      expect(isTokenExpired(tokens)).toBe(true);
    });

    it('should return true for expired tokens', () => {
      const tokens: OAuthTokens = {
        accessToken: 'token',
        tokenType: 'Bearer',
        expiresAt: Date.now() - 1000, // Expired 1 second ago
      };
      expect(isTokenExpired(tokens)).toBe(true);
    });

    it('should return true for tokens expiring within 5 minutes', () => {
      const tokens: OAuthTokens = {
        accessToken: 'token',
        tokenType: 'Bearer',
        expiresAt: Date.now() + 4 * 60 * 1000, // Expires in 4 minutes
      };
      expect(isTokenExpired(tokens)).toBe(true);
    });

    it('should return false for valid tokens with sufficient time', () => {
      const tokens: OAuthTokens = {
        accessToken: 'token',
        tokenType: 'Bearer',
        expiresAt: Date.now() + 10 * 60 * 1000, // Expires in 10 minutes
      };
      expect(isTokenExpired(tokens)).toBe(false);
    });
  });

  describe('determineScopesToRequest', () => {
    it('should prioritize WWW-Authenticate challenge scope', () => {
      const result = determineScopesToRequest(
        'read write',
        ['admin', 'user'],
        ['default']
      );
      expect(result).toEqual(['read', 'write']);
    });

    it('should use scopes_supported if no challenge scope', () => {
      const result = determineScopesToRequest(
        undefined,
        ['admin', 'user'],
        ['default']
      );
      expect(result).toEqual(['admin', 'user']);
    });

    it('should use configured scopes as fallback', () => {
      const result = determineScopesToRequest(
        undefined,
        undefined,
        ['default', 'custom']
      );
      expect(result).toEqual(['default', 'custom']);
    });

    it('should return undefined if no scopes provided', () => {
      const result = determineScopesToRequest();
      expect(result).toBeUndefined();
    });

    it('should filter empty strings from challenge scope', () => {
      const result = determineScopesToRequest('read  write  ', undefined, undefined);
      expect(result).toEqual(['read', 'write']);
    });
  });

  describe('validatePKCESupport', () => {
    it('should pass for server supporting S256', () => {
      const metadata: AuthorizationServerMetadata = {
        issuer: 'https://auth.example.com',
        authorization_endpoint: 'https://auth.example.com/authorize',
        token_endpoint: 'https://auth.example.com/token',
        response_types_supported: ['code'],
        code_challenge_methods_supported: ['S256'],
      };

      expect(() => validatePKCESupport(metadata)).not.toThrow();
    });

    it('should throw if code_challenge_methods_supported is missing', () => {
      const metadata: AuthorizationServerMetadata = {
        issuer: 'https://auth.example.com',
        authorization_endpoint: 'https://auth.example.com/authorize',
        token_endpoint: 'https://auth.example.com/token',
        response_types_supported: ['code'],
      };

      expect(() => validatePKCESupport(metadata)).toThrow(
        'Authorization server does not support PKCE'
      );
    });

    it('should throw if S256 is not supported', () => {
      const metadata: AuthorizationServerMetadata = {
        issuer: 'https://auth.example.com',
        authorization_endpoint: 'https://auth.example.com/authorize',
        token_endpoint: 'https://auth.example.com/token',
        response_types_supported: ['code'],
        code_challenge_methods_supported: ['plain'],
      };

      expect(() => validatePKCESupport(metadata)).toThrow(
        'does not support PKCE with S256'
      );
    });
  });

  describe('parseWWWAuthenticateHeader', () => {
    it('should parse Bearer challenge with quoted values', () => {
      const header = 'Bearer realm="example", scope="read write", error="insufficient_scope"';
      const result = parseWWWAuthenticateHeader(header);

      expect(result).toEqual({
        scheme: 'Bearer',
        scope: 'read write',
        error: 'insufficient_scope',
      });
    });

    it('should parse Bearer challenge with unquoted values', () => {
      const header = 'Bearer scope=read, error=invalid_token';
      const result = parseWWWAuthenticateHeader(header);

      expect(result).toEqual({
        scheme: 'Bearer',
        scope: 'read',
        error: 'invalid_token',
      });
    });

    it('should parse resource_metadata parameter', () => {
      const header = 'Bearer resource_metadata="https://api.example.com/.well-known"';
      const result = parseWWWAuthenticateHeader(header);

      expect(result?.resource_metadata).toBe('https://api.example.com/.well-known');
    });

    it('should return null for non-Bearer challenges', () => {
      const header = 'Basic realm="example"';
      const result = parseWWWAuthenticateHeader(header);

      expect(result).toBeNull();
    });

    it('should return null for empty header', () => {
      const result = parseWWWAuthenticateHeader('');
      expect(result).toBeNull();
    });
  });

  describe('checkInsufficientScope', () => {
    it('should detect insufficient scope error from 403', () => {
      const header = 'Bearer error="insufficient_scope", scope="read write admin"';
      const error = checkInsufficientScope(403, header, ['read']);

      expect(error).toBeTruthy();
      expect(error?.requiredScopes).toEqual(['read', 'write', 'admin']);
      expect(error?.currentScopes).toEqual(['read']);
    });

    it('should return null for non-403 status', () => {
      const header = 'Bearer error="insufficient_scope", scope="admin"';
      const error = checkInsufficientScope(401, header);

      expect(error).toBeNull();
    });

    it('should return null if no WWW-Authenticate header', () => {
      const error = checkInsufficientScope(403);
      expect(error).toBeNull();
    });

    it('should return null if error is not insufficient_scope', () => {
      const header = 'Bearer error="invalid_token"';
      const error = checkInsufficientScope(403, header);

      expect(error).toBeNull();
    });

    it('should include error description if present', () => {
      const header = 'Bearer error="insufficient_scope", scope="admin", error_description="Admin access required"';
      const error = checkInsufficientScope(403, header);

      expect(error?.errorDescription).toBe('Admin access required');
    });
  });

  describe('isClientIdMetadataUrl', () => {
    it('should accept valid HTTPS URLs with paths', () => {
      expect(isClientIdMetadataUrl('https://client.example.com/client.json')).toBe(true);
      expect(isClientIdMetadataUrl('https://example.com/clients/app1')).toBe(true);
    });

    it('should reject HTTP URLs', () => {
      expect(isClientIdMetadataUrl('http://example.com/client.json')).toBe(false);
    });

    it('should reject URLs without path', () => {
      expect(isClientIdMetadataUrl('https://example.com')).toBe(false);
      expect(isClientIdMetadataUrl('https://example.com/')).toBe(false);
    });

    it('should reject invalid URLs', () => {
      expect(isClientIdMetadataUrl('not-a-url')).toBe(false);
      expect(isClientIdMetadataUrl('example.com/path')).toBe(false);
    });
  });
});
