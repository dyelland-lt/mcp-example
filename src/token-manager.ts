/**
 * Token Manager
 *
 * Manages OAuth tokens in memory (could be extended to use secure storage)
 */

import { OAuthTokens, OAuthState, OAuthConfig, isTokenExpired, refreshAccessToken } from './oauth.js';

export class TokenManager {
  private tokens: OAuthTokens | null = null;
  private pendingState: OAuthState | null = null;
  private config: OAuthConfig | null = null;

  /**
   * Store OAuth configuration
   */
  setConfig(config: OAuthConfig): void {
    this.config = config;
  }

  /**
   * Get OAuth configuration
   */
  getConfig(): OAuthConfig | null {
    return this.config;
  }

  /**
   * Store pending OAuth state
   */
  setPendingState(state: OAuthState): void {
    this.pendingState = state;
  }

  /**
   * Get and clear pending OAuth state
   */
  getPendingState(): OAuthState | null {
    const state = this.pendingState;
    this.pendingState = null;
    return state;
  }

  /**
   * Store OAuth tokens
   */
  setTokens(tokens: OAuthTokens): void {
    this.tokens = tokens;
  }

  /**
   * Get stored OAuth tokens
   */
  getTokens(): OAuthTokens | null {
    return this.tokens;
  }

  /**
   * Clear stored tokens
   */
  clearTokens(): void {
    this.tokens = null;
  }

  /**
   * Get valid access token (refreshes if needed)
   */
  async getValidAccessToken(): Promise<string | null> {
    if (!this.tokens) {
      return null;
    }

    // Check if token needs refresh
    if (isTokenExpired(this.tokens)) {
      if (!this.tokens.refreshToken) {
        // No refresh token, must re-authenticate
        this.clearTokens();
        return null;
      }

      if (!this.config) {
        throw new Error('OAuth config not set');
      }

      // Attempt to refresh
      try {
        const newTokens = await refreshAccessToken(this.config, this.tokens.refreshToken);
        this.setTokens(newTokens);
        return newTokens.accessToken;
      } catch (error) {
        // Refresh failed, clear tokens
        this.clearTokens();
        throw error;
      }
    }

    return this.tokens.accessToken;
  }

  /**
   * Check if currently authenticated
   */
  isAuthenticated(): boolean {
    return this.tokens !== null && !isTokenExpired(this.tokens);
  }

  /**
   * Get authentication status summary
   */
  getStatus(): {
    authenticated: boolean;
    hasRefreshToken: boolean;
    expiresAt?: number;
    tokenType?: string;
    scope?: string;
  } {
    if (!this.tokens) {
      return {
        authenticated: false,
        hasRefreshToken: false
      };
    }

    return {
      authenticated: !isTokenExpired(this.tokens),
      hasRefreshToken: !!this.tokens.refreshToken,
      expiresAt: this.tokens.expiresAt,
      tokenType: this.tokens.tokenType,
      scope: this.tokens.scope
    };
  }
}

// Singleton instance
export const tokenManager = new TokenManager();
