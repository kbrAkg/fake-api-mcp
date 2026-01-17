/**
 * Swagger/OpenAPI Parser Utility
 * Fetches and parses OpenAPI specification to extract endpoint metadata
 */

export interface SwaggerParameter {
  name: string;
  in: "path" | "query" | "header" | "body";
  required: boolean;
  schema: {
    type: string;
    format?: string;
  };
}

export interface SwaggerSchema {
  type: string;
  properties?: Record<string, {
    type: string;
    format?: string;
    nullable?: boolean;
  }>;
  items?: { $ref: string };
  $ref?: string;
}

export interface SwaggerEndpoint {
  path: string;
  method: string;
  operationId?: string;
  tags: string[];
  parameters: SwaggerParameter[];
  requestBody?: {
    schema: SwaggerSchema;
  };
  responseSchema?: SwaggerSchema;
}

export interface ParsedSwagger {
  title: string;
  version: string;
  baseUrl: string;
  endpoints: SwaggerEndpoint[];
  schemas: Record<string, SwaggerSchema>;
}

const SWAGGER_URL = "https://fakerestapi.azurewebsites.net/swagger/v1/swagger.json";
const API_BASE_URL = "https://fakerestapi.azurewebsites.net";

/**
 * Fetches the Swagger specification from the FakeRESTApi
 */
export async function fetchSwagger(): Promise<any> {
  const response = await fetch(SWAGGER_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch Swagger: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

/**
 * Extracts the schema name from a $ref string
 * Example: "#/components/schemas/Book" -> "Book"
 */
function extractSchemaName(ref: string): string {
  const parts = ref.split("/");
  return parts[parts.length - 1];
}

/**
 * Parses the Swagger specification and extracts endpoint metadata
 */
export async function parseSwagger(): Promise<ParsedSwagger> {
  const swagger = await fetchSwagger();
  
  const endpoints: SwaggerEndpoint[] = [];
  const schemas: Record<string, SwaggerSchema> = {};

  // Extract schemas from components
  if (swagger.components?.schemas) {
    for (const [name, schema] of Object.entries(swagger.components.schemas)) {
      schemas[name] = schema as SwaggerSchema;
    }
  }

  // Parse paths and operations
  for (const [path, pathItem] of Object.entries(swagger.paths)) {
    const methods = ["get", "post", "put", "delete", "patch"];
    
    for (const method of methods) {
      const operation = (pathItem as any)[method];
      if (!operation) continue;

      const parameters: SwaggerParameter[] = [];
      
      // Extract path and query parameters
      if (operation.parameters) {
        for (const param of operation.parameters) {
          parameters.push({
            name: param.name,
            in: param.in,
            required: param.required || false,
            schema: param.schema || { type: "string" }
          });
        }
      }

      // Extract request body schema
      let requestBody: { schema: SwaggerSchema } | undefined;
      if (operation.requestBody?.content) {
        const contentType = Object.keys(operation.requestBody.content).find(
          ct => ct.includes("application/json")
        );
        if (contentType) {
          const bodySchema = operation.requestBody.content[contentType].schema;
          requestBody = { schema: bodySchema };
        }
      }

      // Extract response schema
      let responseSchema: SwaggerSchema | undefined;
      const successResponse = operation.responses?.["200"];
      if (successResponse?.content) {
        const contentType = Object.keys(successResponse.content).find(
          ct => ct.includes("application/json")
        );
        if (contentType) {
          responseSchema = successResponse.content[contentType].schema;
        }
      }

      endpoints.push({
        path,
        method: method.toUpperCase(),
        operationId: operation.operationId,
        tags: operation.tags || [],
        parameters,
        requestBody,
        responseSchema
      });
    }
  }

  return {
    title: swagger.info?.title || "FakeRESTApi",
    version: swagger.info?.version || "v1",
    baseUrl: API_BASE_URL,
    endpoints,
    schemas
  };
}

/**
 * Generates a tool name from the endpoint path and method
 */
export function generateToolName(endpoint: SwaggerEndpoint): string {
  const { path, method } = endpoint;
  
  // Extract resource name from path
  // /api/v1/Books -> Books
  // /api/v1/Books/{id} -> Books
  // /api/v1/Authors/authors/books/{idBook} -> Authors by Book
  
  const pathParts = path.split("/").filter(p => p && !p.startsWith("{") && p !== "api" && p !== "v1");
  
  if (pathParts.length === 0) {
    return `${method.toLowerCase()}_resource`;
  }

  const resource = pathParts[0].toLowerCase();
  const singularResource = resource.endsWith("ies") 
    ? resource.slice(0, -3) + "y"
    : resource.endsWith("s") 
      ? resource.slice(0, -1) 
      : resource;

  // Check for special paths like /Authors/authors/books/{idBook}
  if (pathParts.length > 1 && path.includes("{id")) {
    const parentResource = pathParts[pathParts.length - 1].toLowerCase();
    const singularParent = parentResource.endsWith("s") 
      ? parentResource.slice(0, -1) 
      : parentResource;
    
    if (method === "GET" && !path.endsWith("{id}")) {
      return `get_${resource}_by_${singularParent}`;
    }
  }

  // Standard CRUD operations
  const hasIdParam = path.includes("{id}") && path.endsWith("{id}");
  
  switch (method) {
    case "GET":
      return hasIdParam ? `get_${singularResource}` : `list_${resource}`;
    case "POST":
      return `create_${singularResource}`;
    case "PUT":
      return `update_${singularResource}`;
    case "DELETE":
      return `delete_${singularResource}`;
    default:
      return `${method.toLowerCase()}_${singularResource}`;
  }
}

/**
 * Generates a human-readable description for the tool
 */
export function generateToolDescription(endpoint: SwaggerEndpoint): string {
  const { path, method, tags } = endpoint;
  const resourceTag = tags[0] || "Resource";
  
  const hasIdParam = path.includes("{id}") && path.endsWith("{id}");
  
  // Check for special paths
  if (path.includes("/books/") && path.includes("{idBook}")) {
    return `Get ${resourceTag} by book ID`;
  }
  if (path.includes("/covers/") && path.includes("{idBook}")) {
    return `Get cover photos by book ID`;
  }

  switch (method) {
    case "GET":
      return hasIdParam 
        ? `Get a single ${resourceTag.slice(0, -1)} by ID`
        : `List all ${resourceTag}`;
    case "POST":
      return `Create a new ${resourceTag.slice(0, -1)}`;
    case "PUT":
      return `Update an existing ${resourceTag.slice(0, -1)} by ID`;
    case "DELETE":
      return `Delete a ${resourceTag.slice(0, -1)} by ID`;
    default:
      return `${method} operation on ${resourceTag}`;
  }
}

export { API_BASE_URL, SWAGGER_URL };
