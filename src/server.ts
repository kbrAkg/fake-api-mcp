/**
 * MCP Server Setup
 * Creates and configures the MCP server with Streamable HTTP transport
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { parseSwagger, SWAGGER_URL } from "./utils/swaggerParser.js";
import { registerTools } from "./tools/toolGenerator.js";

/**
 * Creates and initializes the MCP server with tools from Swagger
 */
export async function createMcpServer(): Promise<McpServer> {
  console.log("Creating MCP Server...");
  
  const server = new McpServer({
    name: "fake-api-mcp",
    version: "1.0.0"
  }, {
    capabilities: {
      tools: {}
    }
  });

  // Fetch and parse Swagger specification
  console.log(`\nFetching Swagger from: ${SWAGGER_URL}`);
  const swagger = await parseSwagger();
  console.log(`Parsed: ${swagger.title} (${swagger.version})`);
  console.log(`Found ${swagger.endpoints.length} endpoints`);
  console.log(`Found ${Object.keys(swagger.schemas).length} schemas: ${Object.keys(swagger.schemas).join(", ")}`);

  // Register tools dynamically
  console.log("\n--- Registering Tools ---");
  await registerTools(server, swagger);

  return server;
}

/**
 * Creates a Streamable HTTP transport for the given request/response
 */
export function createTransport(): StreamableHTTPServerTransport {
  return new StreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID()
  });
}
