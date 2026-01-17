/**
 * Entry Point
 * Express server with Streamable HTTP transport for MCP
 */

import express, { Request, Response } from "express";
import cors from "cors";
import { createMcpServer, createTransport } from "./server.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

const PORT = process.env.PORT || 3000;

async function main() {
  console.log("=".repeat(50));
  console.log("FakeRESTApi MCP Server");
  console.log("Streamable HTTP Transport");
  console.log("=".repeat(50));

  // Create Express app
  const app = express();
  
  // Middleware
  app.use(cors());
  app.use(express.json());

  // Create MCP server and register tools
  const mcpServer = await createMcpServer();

  // Store active transports by session ID
  const transports: Map<string, StreamableHTTPServerTransport> = new Map();

  /**
   * Health check endpoint
   */
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ 
      status: "healthy", 
      server: "fake-api-mcp",
      transport: "streamable-http",
      sessions: transports.size
    });
  });

  /**
   * POST /mcp - Handle MCP JSON-RPC requests
   * Creates new session on initialize request, reuses existing session otherwise
   */
  app.post("/mcp", async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    try {
      if (sessionId && transports.has(sessionId)) {
        // Reuse existing transport
        transport = transports.get(sessionId)!;
      } else if (!sessionId && isInitializeRequest(req.body)) {
        // Create new transport for initialize request
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => crypto.randomUUID(),
          onsessioninitialized: (newSessionId) => {
            transports.set(newSessionId, transport);
            console.log(`New session created: ${newSessionId}`);
          }
        });

        // Clean up on close
        transport.onclose = () => {
          const sid = Array.from(transports.entries())
            .find(([_, t]) => t === transport)?.[0];
          if (sid) {
            transports.delete(sid);
            console.log(`Session closed: ${sid}`);
          }
        };

        // Connect the MCP server to this transport
        await mcpServer.connect(transport);
      } else {
        // Invalid request - no session ID and not an initialize request
        res.status(400).json({
          jsonrpc: "2.0",
          error: {
            code: -32600,
            message: "Invalid request: Missing session ID or not an initialize request"
          },
          id: null
        });
        return;
      }

      // Handle the request
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("Error handling POST /mcp:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: error instanceof Error ? error.message : "Internal server error"
          },
          id: null
        });
      }
    }
  });

  /**
   * GET /mcp - SSE endpoint for server-to-client notifications
   */
  app.get("/mcp", async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string;

    if (!sessionId || !transports.has(sessionId)) {
      res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: -32600,
          message: "Invalid or missing session ID"
        },
        id: null
      });
      return;
    }

    const transport = transports.get(sessionId)!;

    try {
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error("Error handling GET /mcp:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: error instanceof Error ? error.message : "Internal server error"
          },
          id: null
        });
      }
    }
  });

  /**
   * DELETE /mcp - Terminate a session
   */
  app.delete("/mcp", async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string;

    if (!sessionId || !transports.has(sessionId)) {
      res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: -32600,
          message: "Invalid or missing session ID"
        },
        id: null
      });
      return;
    }

    const transport = transports.get(sessionId)!;

    try {
      await transport.handleRequest(req, res);
      transports.delete(sessionId);
      console.log(`Session terminated: ${sessionId}`);
    } catch (error) {
      console.error("Error handling DELETE /mcp:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: error instanceof Error ? error.message : "Internal server error"
          },
          id: null
        });
      }
    }
  });

  /**
   * Root endpoint - server info
   */
  app.get("/", (_req: Request, res: Response) => {
    res.json({
      name: "fake-api-mcp",
      description: "MCP Server for FakeRESTApi",
      version: "1.0.0",
      transport: "streamable-http",
      endpoints: {
        mcp: "/mcp",
        health: "/health"
      },
      usage: {
        initialize: "POST /mcp with initialize request",
        request: "POST /mcp with Mcp-Session-Id header",
        notifications: "GET /mcp with Mcp-Session-Id header (SSE)",
        terminate: "DELETE /mcp with Mcp-Session-Id header"
      }
    });
  });

  // Start the server
  app.listen(PORT, () => {
    console.log("\n" + "=".repeat(50));
    console.log(`Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
    console.log("=".repeat(50));
  });
}

// Run the server
main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
