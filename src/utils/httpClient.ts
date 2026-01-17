/**
 * HTTP Client Utility
 * Wrapper for making API requests with MCP error handling
 */

import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { API_BASE_URL } from "./swaggerParser.js";

export interface RequestOptions {
  method: string;
  path: string;
  pathParams?: Record<string, string | number>;
  queryParams?: Record<string, string | number>;
  body?: unknown;
}

/**
 * Replaces path parameters in a URL template
 * Example: /api/v1/Books/{id} with {id: 1} -> /api/v1/Books/1
 */
function buildUrl(path: string, pathParams?: Record<string, string | number>, queryParams?: Record<string, string | number>): string {
  let url = `${API_BASE_URL}${path}`;
  
  // Replace path parameters
  if (pathParams) {
    for (const [key, value] of Object.entries(pathParams)) {
      url = url.replace(`{${key}}`, String(value));
    }
  }
  
  // Add query parameters
  if (queryParams && Object.keys(queryParams).length > 0) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(queryParams)) {
      params.append(key, String(value));
    }
    url += `?${params.toString()}`;
  }
  
  return url;
}

/**
 * Makes an HTTP request to the FakeRESTApi
 * Throws McpError on failure for proper MCP error responses
 */
export async function makeRequest(options: RequestOptions): Promise<unknown> {
  const { method, path, pathParams, queryParams, body } = options;
  
  const url = buildUrl(path, pathParams, queryParams);
  
  const fetchOptions: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json"
    }
  };
  
  if (body && (method === "POST" || method === "PUT" || method === "PATCH")) {
    fetchOptions.body = JSON.stringify(body);
  }
  
  try {
    const response = await fetch(url, fetchOptions);
    
    // Handle different response status codes
    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      
      switch (response.status) {
        case 400:
          throw new McpError(
            ErrorCode.InvalidParams,
            `Bad Request: ${errorText}`
          );
        case 404:
          throw new McpError(
            ErrorCode.InvalidParams,
            `Resource not found: ${url}`
          );
        case 500:
        case 502:
        case 503:
          throw new McpError(
            ErrorCode.InternalError,
            `Server Error (${response.status}): ${errorText}`
          );
        default:
          throw new McpError(
            ErrorCode.InternalError,
            `API Error (${response.status}): ${errorText}`
          );
      }
    }
    
    // Handle empty responses (like DELETE)
    const contentLength = response.headers.get("content-length");
    if (contentLength === "0" || response.status === 204) {
      return { success: true, message: "Operation completed successfully" };
    }
    
    // Parse JSON response
    const data = await response.json().catch(() => {
      return { success: true, message: "Operation completed successfully" };
    });
    
    return data;
    
  } catch (error) {
    // Re-throw McpError as-is
    if (error instanceof McpError) {
      throw error;
    }
    
    // Wrap other errors in McpError
    const message = error instanceof Error ? error.message : "Unknown error occurred";
    throw new McpError(
      ErrorCode.InternalError,
      `Request failed: ${message}`
    );
  }
}

/**
 * Convenience methods for common HTTP operations
 */
export const httpClient = {
  get: (path: string, pathParams?: Record<string, string | number>, queryParams?: Record<string, string | number>) =>
    makeRequest({ method: "GET", path, pathParams, queryParams }),
    
  post: (path: string, body: unknown, pathParams?: Record<string, string | number>) =>
    makeRequest({ method: "POST", path, pathParams, body }),
    
  put: (path: string, body: unknown, pathParams?: Record<string, string | number>) =>
    makeRequest({ method: "PUT", path, pathParams, body }),
    
  delete: (path: string, pathParams?: Record<string, string | number>) =>
    makeRequest({ method: "DELETE", path, pathParams })
};
