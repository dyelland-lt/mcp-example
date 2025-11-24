# Testing Guide

This project uses **Vitest** for testing. We have comprehensive test coverage including unit tests for OAuth functionality, token management, and integration tests for the MCP server.

## Test Structure

```
src/__tests__/
├── oauth.test.ts              # OAuth utility function tests (46 tests)
├── token-manager.test.ts      # Token management tests (19 tests)
└── server.integration.test.ts # MCP server integration tests (15 tests)
```

## Running Tests

### Run all tests once
```bash
pnpm test
```

### Watch mode (re-runs tests on file changes)
```bash
pnpm test:watch
```

### Interactive UI mode
```bash
pnpm test:ui
```

### Coverage report
```bash
pnpm test:coverage
```

## Test Categories

### 1. OAuth Unit Tests (`oauth.test.ts`)

Tests for OAuth 2.0 flow implementation including:
- **PKCE functions**: `generateRandomString`, `generateCodeChallenge`, `createOAuthState`
- **Authorization URL building**: Proper parameter encoding, scope handling, resource parameters
- **Token exchange**: Authorization code exchange, token refresh, error handling
- **Token validation**: Expiration checks, scope determination
- **RFC compliance**: PKCE support validation, WWW-Authenticate header parsing
- **Client ID metadata**: URL validation for Client ID Metadata Documents

**Key test patterns:**
```typescript
// Testing authorization URL building
const url = buildAuthorizationUrl(config, state, scopes);
expect(url).toContain('code_challenge_method=S256');

// Testing token expiration
const tokens = { accessToken: 'token', expiresAt: Date.now() - 1000 };
expect(isTokenExpired(tokens)).toBe(true);
```

### 2. Token Manager Unit Tests (`token-manager.test.ts`)

Tests for in-memory token management:
- **Configuration management**: Store and retrieve OAuth configs
- **State management**: Pending OAuth state handling
- **Token storage**: Store, retrieve, and clear tokens
- **Authentication status**: Check authentication state
- **Token refresh**: Automatic refresh on expiration
- **Error handling**: Handle refresh failures gracefully

**Key test patterns:**
```typescript
// Testing automatic token refresh
tokenManager.setConfig(config);
tokenManager.setTokens(expiredTokens);

// Mock fetch for refresh request
global.fetch = vi.fn().mockResolvedValueOnce({
  ok: true,
  json: async () => ({ access_token: 'new-token', expires_in: 3600 })
});

const token = await tokenManager.getValidAccessToken();
expect(token).toBe('new-token');
```

### 3. MCP Server Integration Tests (`server.integration.test.ts`)

End-to-end tests using `InMemoryTransport`:
- **Tool discovery**: List and inspect available tools
- **OAuth tool integration**: Configure, initiate, status, logout
- **GraphQL query tool**: Authentication requirements, validation
- **Resource discovery**: List available resources
- **Resource reading**: Read resources, error handling

**Key test patterns:**
```typescript
// Using InMemoryTransport for fast integration tests
const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
const client = new Client({ name: 'test-client', version: '1.0.0' });
const server = createMCPServer();

await Promise.all([
  client.connect(clientTransport),
  server.connect(serverTransport)
]);

// Test tool calling
const response = await client.callTool({
  name: 'oauth_configure',
  arguments: { clientId: 'test-client', ... }
});
```

## Best Practices

### 1. Use InMemoryTransport for Integration Tests
- **Fast**: No network overhead
- **Isolated**: No external dependencies
- **Deterministic**: Predictable behavior

```typescript
const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
```

### 2. Mock External APIs
Always mock `fetch` for external API calls:

```typescript
beforeEach(() => {
  global.fetch = vi.fn();
});

// In test
global.fetch = vi.fn().mockResolvedValueOnce({
  ok: true,
  json: async () => ({ access_token: 'test-token' })
});
```

### 3. Clean State Between Tests
Always reset state in `beforeEach`:

```typescript
beforeEach(() => {
  tokenManager.clearTokens();
  (tokenManager as any).config = null;
  vi.clearAllMocks();
});
```

### 4. Test Error Paths
Don't just test happy paths:

```typescript
it('should throw error on failed token exchange', async () => {
  global.fetch = vi.fn().mockResolvedValueOnce({
    ok: false,
    text: async () => 'Invalid grant'
  });

  await expect(
    exchangeCodeForToken(config, 'invalid-code', 'verifier')
  ).rejects.toThrow('Token exchange failed');
});
```

### 5. Don't Test LLM Behavior
For MCP servers that integrate with LLMs:
- ✅ Test that tools are discoverable
- ✅ Test tool call formatting and validation
- ✅ Test error handling
- ❌ DON'T test LLM reasoning quality (too non-deterministic)

Use fixtures or mock responses for LLM integration tests:

```typescript
// Instead of calling real LLM
client.setRequestHandler(CreateMessageRequestSchema, async () => ({
  model: 'test-model',
  role: 'assistant',
  content: { type: 'text', text: 'Deterministic test response' }
}));
```

## Continuous Integration

Tests run automatically on:
- Every commit (via pre-commit hooks, if configured)
- Pull requests (via CI/CD pipeline)
- Before deployment

All tests must pass before merging.

## Writing New Tests

### Adding a Unit Test

1. Create or update test file in `src/__tests__/`
2. Follow the naming convention: `<module-name>.test.ts`
3. Group related tests with `describe` blocks
4. Use clear, descriptive test names with `it`

```typescript
describe('MyFunction', () => {
  it('should handle valid input correctly', () => {
    const result = myFunction('valid-input');
    expect(result).toBe('expected-output');
  });

  it('should throw error on invalid input', () => {
    expect(() => myFunction('invalid')).toThrow('Error message');
  });
});
```

### Adding an Integration Test

1. Use `InMemoryTransport` for MCP protocol communication
2. Set up client and server in `beforeEach`
3. Test complete request/response cycles
4. Verify both success and error scenarios

```typescript
it('should handle tool call with proper error response', async () => {
  const response = await client.callTool({
    name: 'my-tool',
    arguments: { invalid: 'data' }
  });

  expect((response as any).content[0].text).toContain('Error message');
});
```

## Test Coverage Goals

- **Unit tests**: 90%+ coverage for utility functions
- **Integration tests**: Cover all MCP protocol interactions
- **Critical paths**: 100% coverage for authentication and security

Current coverage: **80 tests passing**
- OAuth utilities: 46 tests
- Token manager: 19 tests
- MCP server integration: 15 tests
