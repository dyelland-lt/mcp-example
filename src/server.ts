#!/usr/bin/env node

import {Server} from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {GraphQLClient} from "graphql-request";

/**
 * Rick and Morty MCP Server
 *
 * This server provides access to the Rick and Morty GraphQL API
 * through the Model Context Protocol.
 */

// GraphQL configuration
const GRAPHQL_ENDPOINT = "https://rickandmortyapi.com/graphql";

/**
 * Creates a GraphQL client with configured endpoint
 */
async function createGraphQLClient(): Promise<GraphQLClient> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  return new GraphQLClient(GRAPHQL_ENDPOINT, { headers });
}

/**
 * Creates and configures the MCP server with all handlers
 * @param options Configuration options for the server
 */
export function createMCPServer(): Server {
  const server = new Server(
    {
      name: "rick-and-morty-mcp-server",
      version: "1.0.0"
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  /**
   * Handler for listing available tools
   */
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools: any[] = [
      {
        name: "query",
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
    ];

    return { tools };
  });

  /**
   * Handler for calling tools
   */
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const {name, arguments: args} = request.params;

    // Block OAuth tools if disabled
    if (disableOAuth && name.startsWith("oauth_")) {
      return {
        content: [
          {
            type: "text",
            text: `OAuth functionality is disabled for this server connection.`
          }
        ],
        isError: true
      };
    }

    switch (name) {
      case "query": {
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
          const client = await createGraphQLClient();
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
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';

          return {
            content: [
              {
                type: "text",
                text: `Rick and Morty API Error: ${errorMessage}`
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



  return server;
}
