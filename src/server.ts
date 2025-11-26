#!/usr/bin/env node

import {Server} from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
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
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
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
   * Handler for listing available resources
   */
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: "rickandmorty://characters/popular",
          name: "Popular Characters",
          description: "A curated list of popular Rick and Morty characters with their details",
          mimeType: "application/json"
        },
        {
          uri: "rickandmorty://info/api",
          name: "API Information",
          description: "Information about the Rick and Morty API capabilities and structure",
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

    if (uri === "rickandmorty://characters/popular") {
      try {
        const client = await createGraphQLClient();
        // Get first few main characters (Rick, Morty, Summer, Beth, Jerry)
        const query = `query {
          charactersByIds(ids: ["1", "2", "3", "4", "5"]) {
            id name status species type gender
            origin { name }
            location { name }
            image
          }
        }`;
        const data = await client.request(query);

        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify(data, null, 2)
            }
          ]
        };
      } catch (error) {
        throw new Error(`Failed to fetch popular characters: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else if (uri === "rickandmorty://info/api") {
      const apiInfo = `Rick and Morty API Information
================================

Endpoint: ${GRAPHQL_ENDPOINT}

Available Queries:
- Characters: Query characters by ID, filters (name, status, species, type, gender), or multiple IDs
- Episodes: Query episodes by ID, filters (name, episode code), or multiple IDs
- Locations: Query locations by ID, filters (name, type, dimension), or multiple IDs

Character Statuses: Alive, Dead, unknown
Character Genders: Female, Male, Genderless, unknown

The API supports pagination for list queries (20 results per page by default).

Note: This is a public API with no authentication required.`;

      return {
        contents: [
          {
            uri,
            mimeType: "text/plain",
            text: apiInfo
          }
        ]
      };
    }

    throw new Error(`Unknown resource: ${uri}`);
  });

  /**
   * Handler for listing available prompts
   */
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
      prompts: [
        {
          name: "character-analysis",
          description: "Analyze a Rick and Morty character's personality, role, and story arc",
          arguments: [
            {
              name: "character_name",
              description: "Name of the character to analyze",
              required: true
            }
          ]
        },
        {
          name: "episode-summary",
          description: "Get a summary request for a specific episode with its characters",
          arguments: [
            {
              name: "episode_code",
              description: "Episode code (e.g., S01E01)",
              required: true
            }
          ]
        },
        {
          name: "character-comparison",
          description: "Compare two characters from the show",
          arguments: [
            {
              name: "character1",
              description: "First character name",
              required: true
            },
            {
              name: "character2",
              description: "Second character name",
              required: true
            }
          ]
        }
      ]
    };
  });

  /**
   * Handler for getting prompts
   */
  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const {name, arguments: args} = request.params;

    switch (name) {
      case "character-analysis": {
        const characterName = args?.character_name as string;
        if (!characterName) {
          throw new Error("character_name argument is required");
        }

        return {
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `Please analyze the Rick and Morty character "${characterName}". Use the query tool to fetch their information first, then provide insights about:

1. Their personality traits and characteristics
2. Their role in the show and relationships with other characters
3. Their character development throughout the series
4. Notable episodes or story arcs they're involved in
5. What makes them unique or memorable

Start by using the query tool to fetch character data by searching for characters with name="${characterName}".`
              }
            }
          ]
        };
      }

      case "episode-summary": {
        const episodeCode = args?.episode_code as string;
        if (!episodeCode) {
          throw new Error("episode_code argument is required");
        }

        return {
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `Please provide information about Rick and Morty episode ${episodeCode}. Use the query tool to:

1. Fetch the episode details (name, air date, episode code)
2. Get information about the main characters appearing in this episode
3. Summarize what you can determine about the episode based on its title and characters

Start by querying episodes with the filter episode="${episodeCode}".`
              }
            }
          ]
        };
      }

      case "character-comparison": {
        const character1 = args?.character1 as string;
        const character2 = args?.character2 as string;

        if (!character1 || !character2) {
          throw new Error("Both character1 and character2 arguments are required");
        }

        return {
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `Please compare the Rick and Morty characters "${character1}" and "${character2}". Use the query tool to fetch information about both characters, then compare:

1. Their personalities and character traits
2. Their roles and importance in the show
3. Their relationships with other characters
4. Their character development
5. Similarities and differences between them

Start by querying for each character separately using their names.`
              }
            }
          ]
        };
      }

      default:
        throw new Error(`Unknown prompt: ${name}`);
    }
  });

  /**
   * Handler for calling tools
   */
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const {name, arguments: args} = request.params;

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