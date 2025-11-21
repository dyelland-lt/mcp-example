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
import {GraphQLClient} from "graphql-request";
import {parse, OperationDefinitionNode} from "graphql";

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

// GraphQL configuration
const GRAPHQL_ENDPOINT = process.env.GRAPHQL_ENDPOINT || "https://rickandmortyapi.com/graphql";
const GRAPHQL_AUTH_TOKEN = process.env.GRAPHQL_AUTH_TOKEN;

/**
 * Validates that a GraphQL query is read-only (no mutations)
 * @throws Error if the query contains mutations
 */
function validateReadOnlyQuery(query: string): void {
  try {
    const document = parse(query);

    for (const definition of document.definitions) {
      if (definition.kind === 'OperationDefinition') {
        const operation = definition as OperationDefinitionNode;
        if (operation.operation === 'mutation') {
          throw new Error('Mutations are not allowed. Only queries are permitted.');
        }
      }
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('Mutations are not allowed')) {
      throw error;
    }
    throw new Error(`Invalid GraphQL query: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Creates a GraphQL client with configured endpoint and authentication
 */
function createGraphQLClient(endpoint?: string): GraphQLClient {
  const url = endpoint || GRAPHQL_ENDPOINT;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if (GRAPHQL_AUTH_TOKEN) {
    headers['Authorization'] = `Bearer ${GRAPHQL_AUTH_TOKEN}`;
  }

  return new GraphQLClient(url, { headers });
}

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
      },
      {
        name: "rick_and_morty_query",
        description: "Query characters, episodes, or locations from the Rick and Morty API. Returns character data including name, status (Alive/Dead/unknown), species, type, gender, origin location, current location, image, and episodes. Note: The API's built-in filters are limited - origin and current location cannot be filtered and must be filtered client-side from results.",
        inputSchema: {
          type: "object",
          properties: {
            queryType: {
              type: "string",
              enum: ["character", "characters", "charactersByIds", "episode", "episodes", "episodesByIds", "location", "locations", "locationsByIds"],
              description: "Type of query: 'character' (single by ID), 'characters' (list with filters), 'charactersByIds' (multiple by IDs), 'episode' (single by ID), 'episodes' (list with filters), 'episodesByIds' (multiple by IDs), 'location' (single by ID), 'locations' (list with filters), 'locationsByIds' (multiple by IDs)"
            },
            id: {
              type: "number",
              description: "ID for single entity queries (character, episode, location)"
            },
            ids: {
              type: "array",
              items: {
                type: "number"
              },
              description: "Array of IDs for batch queries (charactersByIds, episodesByIds, locationsByIds)"
            },
            filters: {
              type: "object",
              description: "Filters for list queries. Characters: name (string), status (string: 'Alive'/'Dead'/'unknown'), species (string), type (string), gender (string: 'Female'/'Male'/'Genderless'/'unknown'). Episodes: name (string), episode (string, e.g. 'S01E01'). Locations: name (string), type (string), dimension (string). IMPORTANT: origin and current location are NOT filterable via API.",
              additionalProperties: true
            },
            page: {
              type: "number",
              description: "Page number for paginated list queries (default: 1)"
            }
          },
          required: ["queryType"]
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

    case "rick_and_morty_query": {
      try {
        const queryType = args?.queryType as string;
        const id = args?.id as number | undefined;
        const ids = args?.ids as number[] | undefined;
        const filters = (args?.filters as Record<string, any>) || {};
        const page = (args?.page as number) || 1;

        let query = "";
        let variables: Record<string, any> = {};

        // Build query based on type
        switch (queryType) {
          case "character":
            if (!id) throw new Error("ID required for single character query");
            query = `query($id: ID!) {
              character(id: $id) {
                id name status species type gender
                origin { id name type dimension }
                location { id name type dimension }
                image episode { id name episode }
                created
              }
            }`;
            variables = { id: id.toString() };
            break;

          case "characters":
            query = `query($page: Int, $name: String, $status: String, $species: String, $type: String, $gender: String) {
              characters(page: $page, filter: { name: $name, status: $status, species: $species, type: $type, gender: $gender }) {
                info { count pages next prev }
                results {
                  id name status species type gender
                  origin { id name type dimension }
                  location { id name type dimension }
                  image
                }
              }
            }`;
            variables = { page, ...filters };
            break;

          case "charactersByIds":
            if (!ids || ids.length === 0) throw new Error("IDs array required for charactersByIds query");
            query = `query($ids: [ID!]!) {
              charactersByIds(ids: $ids) {
                id name status species type gender
                origin { id name type dimension }
                location { id name type dimension }
                image episode { id name episode }
              }
            }`;
            variables = { ids: ids.map(i => i.toString()) };
            break;

          case "episode":
            if (!id) throw new Error("ID required for single episode query");
            query = `query($id: ID!) {
              episode(id: $id) {
                id name air_date episode
                characters { id name species }
                created
              }
            }`;
            variables = { id: id.toString() };
            break;

          case "episodes":
            query = `query($page: Int, $name: String, $episode: String) {
              episodes(page: $page, filter: { name: $name, episode: $episode }) {
                info { count pages next prev }
                results {
                  id name air_date episode
                }
              }
            }`;
            variables = { page, ...filters };
            break;

          case "episodesByIds":
            if (!ids || ids.length === 0) throw new Error("IDs array required for episodesByIds query");
            query = `query($ids: [ID!]!) {
              episodesByIds(ids: $ids) {
                id name air_date episode
                characters { id name species }
              }
            }`;
            variables = { ids: ids.map(i => i.toString()) };
            break;

          case "location":
            if (!id) throw new Error("ID required for single location query");
            query = `query($id: ID!) {
              location(id: $id) {
                id name type dimension
                residents { id name species }
                created
              }
            }`;
            variables = { id: id.toString() };
            break;

          case "locations":
            query = `query($page: Int, $name: String, $type: String, $dimension: String) {
              locations(page: $page, filter: { name: $name, type: $type, dimension: $dimension }) {
                info { count pages next prev }
                results {
                  id name type dimension
                }
              }
            }`;
            variables = { page, ...filters };
            break;

          case "locationsByIds":
            if (!ids || ids.length === 0) throw new Error("IDs array required for locationsByIds query");
            query = `query($ids: [ID!]!) {
              locationsByIds(ids: $ids) {
                id name type dimension
                residents { id name species }
              }
            }`;
            variables = { ids: ids.map(i => i.toString()) };
            break;

          default:
            throw new Error(`Unknown query type: ${queryType}`);
        }

        // Create client and execute query
        const client = createGraphQLClient();
        const data = await client.request(query, variables);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Rick and Morty API Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            }
          ],
          isError: true
        };
      }
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
