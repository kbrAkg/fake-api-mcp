/**
 * Dynamic Tool Generator
 * Generates MCP tools from parsed Swagger/OpenAPI specification
 */

import { z, ZodObject, ZodRawShape } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { 
  ParsedSwagger, 
  SwaggerEndpoint, 
  SwaggerSchema,
  generateToolName, 
  generateToolDescription 
} from "../utils/swaggerParser.js";
import { makeRequest } from "../utils/httpClient.js";

/**
 * Converts a Swagger/JSON Schema type to a Zod schema
 */
function jsonSchemaTypeToZod(type: string, format?: string, nullable?: boolean): z.ZodTypeAny {
  let zodType: z.ZodTypeAny;
  
  switch (type) {
    case "integer":
      zodType = z.number().int();
      break;
    case "number":
      zodType = z.number();
      break;
    case "boolean":
      zodType = z.boolean();
      break;
    case "string":
      if (format === "date-time") {
        zodType = z.string().describe("ISO 8601 date-time format");
      } else if (format === "uri") {
        zodType = z.string().url();
      } else {
        zodType = z.string();
      }
      break;
    default:
      zodType = z.any();
  }
  
  if (nullable) {
    zodType = zodType.nullable();
  }
  
  return zodType;
}

/**
 * Builds a Zod schema for request body based on Swagger schema
 */
function buildBodySchema(
  schemaRef: SwaggerSchema | undefined, 
  schemas: Record<string, SwaggerSchema>
): ZodRawShape | undefined {
  if (!schemaRef) return undefined;
  
  // Resolve $ref
  let schema = schemaRef;
  if (schemaRef.$ref) {
    const refName = schemaRef.$ref.split("/").pop();
    if (refName && schemas[refName]) {
      schema = schemas[refName];
    }
  }
  
  if (!schema.properties) return undefined;
  
  const zodShape: ZodRawShape = {};
  
  for (const [propName, propSchema] of Object.entries(schema.properties)) {
    // Skip 'id' field for create operations as it's usually auto-generated
    zodShape[propName] = jsonSchemaTypeToZod(
      propSchema.type,
      propSchema.format,
      propSchema.nullable
    ).optional();
  }
  
  return zodShape;
}

/**
 * Builds the input schema for a tool based on endpoint parameters and request body
 */
function buildInputSchema(
  endpoint: SwaggerEndpoint,
  schemas: Record<string, SwaggerSchema>
): ZodRawShape {
  const shape: ZodRawShape = {};
  
  // Add path parameters
  for (const param of endpoint.parameters) {
    if (param.in === "path") {
      const zodType = jsonSchemaTypeToZod(param.schema.type, param.schema.format);
      shape[param.name] = param.required ? zodType : zodType.optional();
    }
  }
  
  // Add request body fields for POST/PUT
  if (endpoint.requestBody?.schema && (endpoint.method === "POST" || endpoint.method === "PUT")) {
    const bodyShape = buildBodySchema(endpoint.requestBody.schema, schemas);
    if (bodyShape) {
      // For simplicity, flatten body fields into the input
      // Exclude 'id' for create operations
      for (const [key, value] of Object.entries(bodyShape)) {
        if (endpoint.method === "POST" && key === "id") continue;
        shape[key] = value;
      }
    }
  }
  
  return shape;
}

/**
 * Extracts path parameters from input arguments
 */
function extractPathParams(
  args: Record<string, unknown>,
  endpoint: SwaggerEndpoint
): Record<string, string | number> {
  const pathParams: Record<string, string | number> = {};
  
  for (const param of endpoint.parameters) {
    if (param.in === "path" && args[param.name] !== undefined) {
      pathParams[param.name] = args[param.name] as string | number;
    }
  }
  
  return pathParams;
}

/**
 * Extracts request body from input arguments
 */
function extractBody(
  args: Record<string, unknown>,
  endpoint: SwaggerEndpoint
): Record<string, unknown> | undefined {
  if (endpoint.method !== "POST" && endpoint.method !== "PUT") {
    return undefined;
  }
  
  const body: Record<string, unknown> = {};
  const pathParamNames = endpoint.parameters
    .filter(p => p.in === "path")
    .map(p => p.name);
  
  for (const [key, value] of Object.entries(args)) {
    if (!pathParamNames.includes(key) && value !== undefined) {
      body[key] = value;
    }
  }
  
  // For PUT operations, include the id in the body
  if (endpoint.method === "PUT" && args.id !== undefined) {
    body.id = args.id;
  }
  
  return Object.keys(body).length > 0 ? body : undefined;
}

/**
 * Registers all tools from the parsed Swagger specification
 */
export async function registerTools(server: McpServer, swagger: ParsedSwagger): Promise<void> {
  const registeredTools = new Set<string>();
  
  console.log(`Registering tools from ${swagger.endpoints.length} endpoints...`);
  
  for (const endpoint of swagger.endpoints) {
    const toolName = generateToolName(endpoint);
    
    // Skip duplicate tool names (same operation on same resource)
    if (registeredTools.has(toolName)) {
      console.log(`  Skipping duplicate: ${toolName}`);
      continue;
    }
    
    registeredTools.add(toolName);
    
    const description = generateToolDescription(endpoint);
    const inputShape = buildInputSchema(endpoint, swagger.schemas);
    
    // Create the tool
    server.tool(
      toolName,
      description,
      inputShape,
      async (args: Record<string, unknown>) => {
        const pathParams = extractPathParams(args, endpoint);
        const body = extractBody(args, endpoint);
        
        const result = await makeRequest({
          method: endpoint.method,
          path: endpoint.path,
          pathParams,
          body
        });
        
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }
    );
    
    console.log(`  ✓ Registered: ${toolName} (${endpoint.method} ${endpoint.path})`);
  }
  
  console.log(`\nTotal tools registered: ${registeredTools.size}`);
}

/**
 * Gets a list of all tool names that will be generated
 */
export function getToolNames(swagger: ParsedSwagger): string[] {
  const names = new Set<string>();
  for (const endpoint of swagger.endpoints) {
    names.add(generateToolName(endpoint));
  }
  return Array.from(names);
}
