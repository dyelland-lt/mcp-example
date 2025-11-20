#!/usr/bin/env node

import {Server} from "@modelcontextprotocol/sdk/server/index.js";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  ListResourceTemplatesRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

/**
 * Example MCP Server
 *
 * This server demonstrates basic MCP functionality with:
 * - Tools: Functions that can be called by the client
 * - Resources: Data that can be read by the client
 */

// Create server instance
const server = new Server(
  {
    name: "example-mcp-server",
    version: "1.0.0"
  },
  {
    capabilities: {
      tools: {},
      resources: {}
    }
  }
);

// Sample in-memory data store
const notes: {[key: string]: string} = {
  welcome: "Welcome to the example MCP server!",
  info: "This server demonstrates basic MCP capabilities."
};

/**
 * Handler for listing available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "add",
        description: "Add two numbers together",
        inputSchema: {
          type: "object",
          properties: {
            a: {
              type: "number",
              description: "First number"
            },
            b: {
              type: "number",
              description: "Second number"
            }
          },
          required: ["a", "b"]
        }
      },
      {
        name: "echo",
        description: "Echo back the provided message",
        inputSchema: {
          type: "object",
          properties: {
            message: {
              type: "string",
              description: "Message to echo back"
            }
          },
          required: ["message"]
        }
      },
      {
        name: "create_note",
        description: "Create a new note with a key and content",
        inputSchema: {
          type: "object",
          properties: {
            key: {
              type: "string",
              description: "Unique key for the note"
            },
            content: {
              type: "string",
              description: "Content of the note"
            }
          },
          required: ["key", "content"]
        }
      },
      {
        name: "get_timestamp",
        description: "Get the current server timestamp",
        inputSchema: {
          type: "object",
          properties: {}
        }
      }
    ]
  };
});

/**
 * Handler for calling tools
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const {name, arguments: args} = request.params;

  switch (name) {
    case "add": {
      const a = args?.a as number;
      const b = args?.b as number;
      const result = a + b;
      return {
        content: [
          {
            type: "text",
            text: `${a} + ${b} = ${result}`
          }
        ]
      };
    }

    case "echo": {
      const message = args?.message as string;
      return {
        content: [
          {
            type: "text",
            text: `Echo: ${message}`
          }
        ]
      };
    }

    case "create_note": {
      const key = args?.key as string;
      const content = args?.content as string;
      notes[key] = content;
      return {
        content: [
          {
            type: "text",
            text: `Note created with key: ${key}`
          }
        ]
      };
    }

    case "get_timestamp": {
      const timestamp = new Date().toISOString();
      return {
        content: [
          {
            type: "text",
            text: `Current timestamp: ${timestamp}`
          }
        ]
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

/**
 * Handler for listing available resources
 */
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "note://welcome",
        name: "Welcome Note",
        mimeType: "text/plain",
        description: "A welcome message"
      },
      {
        uri: "note://info",
        name: "Info Note",
        mimeType: "text/plain",
        description: "Information about this server"
      },
      ...Object.keys(notes)
        .filter((key) => !["welcome", "info"].includes(key))
        .map((key) => ({
          uri: `note://${key}`,
          name: `Note: ${key}`,
          mimeType: "text/plain",
          description: `User-created note with key: ${key}`
        }))
    ]
  };
});

/**
 * Handler for listing available resource templates
 */
server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
  return {
    resourceTemplates: [
      {
        uriTemplate: "note://{key}",
        name: "Note by Key",
        description: "Access any note by its key",
        mimeType: "text/plain"
      },
      {
        uriTemplate: "user://{userId}/profile",
        name: "User Profile",
        description: "Get user profile information by user ID",
        mimeType: "application/json"
      },
      {
        uriTemplate: "file://{path}",
        name: "File Content",
        description: "Access file content by path",
        mimeType: "text/plain"
      }
    ]
  };
});

/**
 * Handler for reading resources
 */
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;
  const match = uri.match(/^note:\/\/(.+)$/);

  if (!match) {
    throw new Error(`Invalid URI format: ${uri}`);
  }

  const noteKey = match[1];
  const content = notes[noteKey];

  if (!content) {
    throw new Error(`Note not found: ${noteKey}`);
  }

  return {
    contents: [
      {
        uri,
        mimeType: "text/plain",
        text: content
      }
    ]
  };
});

/**
 * Start the server
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Example MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
