import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMCPServer } from '../server.js';
import { tokenManager } from '../token-manager.js';

describe('MCP Server Integration Tests', () => {
  let client: Client;
  let clientTransport: InMemoryTransport;
  let serverTransport: InMemoryTransport;

  beforeEach(async () => {
    // Clear token manager state completely
    tokenManager.clearTokens();
    (tokenManager as any).config = null;
    (tokenManager as any).pendingState = null;
    vi.clearAllMocks();

    // Create linked transports
    [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    // Create and connect client
    client = new Client(
      {
        name: 'test-client',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );

    // Create and connect server
    const server = createMCPServer();

    await Promise.all([
      client.connect(clientTransport),
      server.connect(serverTransport),
    ]);
  });

  describe('Tool Discovery', () => {
    it('should list all available tools', async () => {
      const response = await client.listTools();

      expect(response.tools).toBeDefined();
      expect(response.tools.length).toBeGreaterThan(0);

      // Check for key tools
      const toolNames = response.tools.map((t: any) => t.name);
      expect(toolNames).toContain('query');
      expect(toolNames).toContain('oauth_configure');
      expect(toolNames).toContain('oauth_initiate');
      expect(toolNames).toContain('oauth_complete');
      expect(toolNames).toContain('oauth_status');
      expect(toolNames).toContain('oauth_logout');
    });

    it('should include tool descriptions and schemas', async () => {
      const response = await client.listTools();

      const queryTool = response.tools.find((t: any) => t.name === 'query');
      expect(queryTool).toBeDefined();
      expect(queryTool?.description).toBeTruthy();
      expect(queryTool?.inputSchema).toBeDefined();
      expect(queryTool?.inputSchema.properties).toBeDefined();
    });
  });

  describe('OAuth Tool Integration', () => {
    it('should configure OAuth settings', async () => {
      const response = await client.callTool({
        name: 'oauth_configure',
        arguments: {
          clientId: 'test-client',
          authorizationUrl: 'https://auth.example.com/authorize',
          tokenUrl: 'https://auth.example.com/token',
          redirectUri: 'http://localhost:3000/callback',
          scopes: ['read', 'write'],
          resource: 'https://api.example.com',
        },
      });

      expect((response as any).content).toBeDefined();
      expect((response as any).content[0]).toHaveProperty('type', 'text');
      expect((response as any).content[0].text).toContain('OAuth configuration saved');
      expect((response as any).content[0].text).toContain('test-client');
    });

    it('should initiate OAuth flow after configuration', async () => {
      // Configure first
      await client.callTool({
        name: 'oauth_configure',
        arguments: {
          clientId: 'test-client',
          authorizationUrl: 'https://auth.example.com/authorize',
          tokenUrl: 'https://auth.example.com/token',
          redirectUri: 'http://localhost:3000/callback',
        },
      });

      // Then initiate
      const response = await client.callTool({
        name: 'oauth_initiate',
        arguments: {},
      });

      expect((response as any).content[0]).toHaveProperty('type', 'text');
      const text = (response as any).content[0].text;
      expect(text).toContain('OAuth flow initiated');
      expect(text).toContain('https://auth.example.com/authorize');
      expect(text).toContain('State:');
    });

    it('should error when initiating without configuration', async () => {
      const response = await client.callTool({
        name: 'oauth_initiate',
        arguments: {},
      });

      expect((response as any).content[0].text).toContain('OAuth not configured');
    });

    it('should return OAuth status', async () => {
      const response = await client.callTool({
        name: 'oauth_status',
        arguments: {},
      });

      expect((response as any).content[0]).toHaveProperty('type', 'text');
      const text = (response as any).content[0].text;
      expect(text).toContain('OAuth Status');
      expect(text).toContain('Configured:');
      expect(text).toContain('Authenticated:');
    });

    it('should logout and clear tokens', async () => {
      const response = await client.callTool({
        name: 'oauth_logout',
        arguments: {},
      });

      expect((response as any).content[0].text).toContain('Successfully logged out');
    });
  });

  describe('GraphQL Query Tool', () => {
    it('should require authentication before querying', async () => {
      const response = await client.callTool({
        name: 'query',
        arguments: {
          queryType: 'character',
          id: 1,
        },
      });

      expect((response as any).isError).toBe(true);
      expect((response as any).content[0].text).toContain('Authentication required');
    });

    it('should error on invalid query type', async () => {
      // Mock authenticated state
      tokenManager.setConfig({
        clientId: 'test',
        authorizationUrl: 'https://auth.example.com/authorize',
        tokenUrl: 'https://auth.example.com/token',
        redirectUri: 'http://localhost:3000/callback',
      });
      tokenManager.setTokens({
        accessToken: 'test-token',
        tokenType: 'Bearer',
        expiresAt: Date.now() + 3600000,
      });

      const response = await client.callTool({
        name: 'query',
        arguments: {
          queryType: 'invalid-type',
        },
      });

      expect((response as any).isError).toBe(true);
      expect((response as any).content[0].text).toContain('Unknown query type');
    });

    it('should validate required parameters', async () => {
      // Mock authenticated state
      tokenManager.setConfig({
        clientId: 'test',
        authorizationUrl: 'https://auth.example.com/authorize',
        tokenUrl: 'https://auth.example.com/token',
        redirectUri: 'http://localhost:3000/callback',
      });
      tokenManager.setTokens({
        accessToken: 'test-token',
        tokenType: 'Bearer',
        expiresAt: Date.now() + 3600000,
      });

      const response = await client.callTool({
        name: 'query',
        arguments: {
          queryType: 'character',
          // Missing required 'id' parameter
        },
      });

      expect((response as any).isError).toBe(true);
      expect((response as any).content[0].text).toContain('ID required');
    });
  });

  describe('Resource Discovery', () => {
    it('should list available resources', async () => {
      const response = await client.listResources();

      expect(response.resources).toBeDefined();
      expect(response.resources.length).toBeGreaterThan(0);

      // Check for default notes
      const uris = response.resources.map((r: any) => r.uri);
      expect(uris).toContain('note://welcome');
      expect(uris).toContain('note://info');
    });

    it('should include resource metadata', async () => {
      const response = await client.listResources();

      const welcomeNote = response.resources.find((r: any) => r.uri === 'note://welcome');
      expect(welcomeNote).toBeDefined();
      expect(welcomeNote?.name).toBe('Welcome Note');
      expect(welcomeNote?.mimeType).toBe('text/plain');
      expect(welcomeNote?.description).toBeTruthy();
    });
  });

  describe('Resource Reading', () => {
    it('should read existing resource', async () => {
      const response = await client.readResource({ uri: 'note://welcome' });

      expect(response.contents).toBeDefined();
      expect(response.contents.length).toBe(1);
      expect(response.contents[0]).toHaveProperty('uri', 'note://welcome');
      expect(response.contents[0]).toHaveProperty('mimeType', 'text/plain');
      expect(response.contents[0]).toHaveProperty('text');
    });

    it('should error on non-existent resource', async () => {
      await expect(
        client.readResource({ uri: 'note://non-existent' })
      ).rejects.toThrow('Note not found');
    });

    it('should error on invalid URI format', async () => {
      await expect(
        client.readResource({ uri: 'invalid://uri' })
      ).rejects.toThrow('Invalid URI format');
    });
  });
});
