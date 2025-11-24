import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TokenManager } from '../token-manager.js';
import type { OAuthConfig, OAuthTokens, OAuthState } from '../oauth.js';

describe('TokenManager', () => {
  let tokenManager: TokenManager;

  beforeEach(() => {
    tokenManager = new TokenManager();
    vi.clearAllMocks();
  });

  describe('config management', () => {
    it('should store and retrieve config', () => {
      const config: OAuthConfig = {
        clientId: 'test-client',
        authorizationUrl: 'https://auth.example.com/authorize',
        tokenUrl: 'https://auth.example.com/token',
        redirectUri: 'http://localhost:3000/callback',
      };

      tokenManager.setConfig(config);
      expect(tokenManager.getConfig()).toEqual(config);
    });

    it('should return null when no config is set', () => {
      expect(tokenManager.getConfig()).toBeNull();
    });
  });

  describe('pending state management', () => {
    it('should store and retrieve pending state', () => {
      const state: OAuthState = {
        state: 'test-state',
        codeVerifier: 'test-verifier',
        codeChallenge: 'test-challenge',
        timestamp: Date.now(),
      };

      tokenManager.setPendingState(state);
      expect(tokenManager.getPendingState()).toEqual(state);
    });

    it('should clear pending state after retrieval', () => {
      const state: OAuthState = {
        state: 'test-state',
        codeVerifier: 'test-verifier',
        codeChallenge: 'test-challenge',
        timestamp: Date.now(),
      };

      tokenManager.setPendingState(state);
      tokenManager.getPendingState();
      expect(tokenManager.getPendingState()).toBeNull();
    });
  });

  describe('token management', () => {
    it('should store and retrieve tokens', () => {
      const tokens: OAuthTokens = {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: Date.now() + 3600000,
        tokenType: 'Bearer',
      };

      tokenManager.setTokens(tokens);
      expect(tokenManager.getTokens()).toEqual(tokens);
    });

    it('should clear tokens', () => {
      const tokens: OAuthTokens = {
        accessToken: 'test-access-token',
        tokenType: 'Bearer',
      };

      tokenManager.setTokens(tokens);
      tokenManager.clearTokens();
      expect(tokenManager.getTokens()).toBeNull();
    });
  });

  describe('isAuthenticated', () => {
    it('should return false when no tokens stored', () => {
      expect(tokenManager.isAuthenticated()).toBe(false);
    });

    it('should return true for valid unexpired tokens', () => {
      const tokens: OAuthTokens = {
        accessToken: 'test-token',
        tokenType: 'Bearer',
        expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes from now
      };

      tokenManager.setTokens(tokens);
      expect(tokenManager.isAuthenticated()).toBe(true);
    });

    it('should return false for expired tokens', () => {
      const tokens: OAuthTokens = {
        accessToken: 'test-token',
        tokenType: 'Bearer',
        expiresAt: Date.now() - 1000, // Expired
      };

      tokenManager.setTokens(tokens);
      expect(tokenManager.isAuthenticated()).toBe(false);
    });

    it('should return false for tokens expiring within 5 minutes', () => {
      const tokens: OAuthTokens = {
        accessToken: 'test-token',
        tokenType: 'Bearer',
        expiresAt: Date.now() + 4 * 60 * 1000, // 4 minutes from now
      };

      tokenManager.setTokens(tokens);
      expect(tokenManager.isAuthenticated()).toBe(false);
    });
  });

  describe('getValidAccessToken', () => {
    it('should return null when no tokens stored', async () => {
      const token = await tokenManager.getValidAccessToken();
      expect(token).toBeNull();
    });

    it('should return access token for valid tokens', async () => {
      const tokens: OAuthTokens = {
        accessToken: 'valid-token',
        tokenType: 'Bearer',
        expiresAt: Date.now() + 10 * 60 * 1000,
      };

      tokenManager.setTokens(tokens);
      const token = await tokenManager.getValidAccessToken();
      expect(token).toBe('valid-token');
    });

    it('should refresh expired tokens if refresh token available', async () => {
      const config: OAuthConfig = {
        clientId: 'test-client',
        authorizationUrl: 'https://auth.example.com/authorize',
        tokenUrl: 'https://auth.example.com/token',
        redirectUri: 'http://localhost:3000/callback',
      };

      const expiredTokens: OAuthTokens = {
        accessToken: 'expired-token',
        refreshToken: 'refresh-token',
        tokenType: 'Bearer',
        expiresAt: Date.now() - 1000, // Expired
      };

      const newTokens: OAuthTokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        tokenType: 'Bearer',
        expiresAt: Date.now() + 3600000,
      };

      // Mock fetch for token refresh
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: newTokens.accessToken,
          refresh_token: newTokens.refreshToken,
          expires_in: 3600,
          token_type: 'Bearer',
        }),
      });

      tokenManager.setConfig(config);
      tokenManager.setTokens(expiredTokens);

      const token = await tokenManager.getValidAccessToken();
      expect(token).toBe('new-access-token');
      expect(tokenManager.getTokens()?.accessToken).toBe('new-access-token');
    });

    it('should clear tokens if no refresh token available', async () => {
      const expiredTokens: OAuthTokens = {
        accessToken: 'expired-token',
        tokenType: 'Bearer',
        expiresAt: Date.now() - 1000,
      };

      tokenManager.setTokens(expiredTokens);
      const token = await tokenManager.getValidAccessToken();

      expect(token).toBeNull();
      expect(tokenManager.getTokens()).toBeNull();
    });

    it('should clear tokens if refresh fails', async () => {
      const config: OAuthConfig = {
        clientId: 'test-client',
        authorizationUrl: 'https://auth.example.com/authorize',
        tokenUrl: 'https://auth.example.com/token',
        redirectUri: 'http://localhost:3000/callback',
      };

      const expiredTokens: OAuthTokens = {
        accessToken: 'expired-token',
        refreshToken: 'invalid-refresh',
        tokenType: 'Bearer',
        expiresAt: Date.now() - 1000,
      };

      // Mock failed refresh
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        text: async () => 'Invalid refresh token',
      });

      tokenManager.setConfig(config);
      tokenManager.setTokens(expiredTokens);

      await expect(tokenManager.getValidAccessToken()).rejects.toThrow(
        'Token refresh failed'
      );
      expect(tokenManager.getTokens()).toBeNull();
    });

    it('should throw error if config not set during refresh', async () => {
      const expiredTokens: OAuthTokens = {
        accessToken: 'expired-token',
        refreshToken: 'refresh-token',
        tokenType: 'Bearer',
        expiresAt: Date.now() - 1000,
      };

      tokenManager.setTokens(expiredTokens);

      await expect(tokenManager.getValidAccessToken()).rejects.toThrow(
        'OAuth config not set'
      );
    });
  });

  describe('getStatus', () => {
    it('should return unauthenticated status when no tokens', () => {
      const status = tokenManager.getStatus();
      expect(status).toEqual({
        authenticated: false,
        hasRefreshToken: false,
      });
    });

    it('should return authenticated status for valid tokens', () => {
      const tokens: OAuthTokens = {
        accessToken: 'test-token',
        refreshToken: 'refresh-token',
        tokenType: 'Bearer',
        expiresAt: Date.now() + 10 * 60 * 1000,
        scope: 'read write',
      };

      tokenManager.setTokens(tokens);
      const status = tokenManager.getStatus();

      expect(status).toEqual({
        authenticated: true,
        hasRefreshToken: true,
        expiresAt: tokens.expiresAt,
        tokenType: 'Bearer',
        scope: 'read write',
      });
    });

    it('should return unauthenticated for expired tokens', () => {
      const tokens: OAuthTokens = {
        accessToken: 'test-token',
        tokenType: 'Bearer',
        expiresAt: Date.now() - 1000,
      };

      tokenManager.setTokens(tokens);
      const status = tokenManager.getStatus();

      expect(status.authenticated).toBe(false);
      expect(status.hasRefreshToken).toBe(false);
    });
  });
});
