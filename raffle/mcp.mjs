import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { serverInfo } from './agent-discovery.mjs';
import { arcadeTools, origin, readOnlyAnnotations, toolResult } from './public/arcade-agent-data.mjs';

export const mcp = express.Router();
mcp.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  const requestOrigin = req.get('Origin');
  if (requestOrigin && requestOrigin !== origin) {
    res.status(403).json({jsonrpc:'2.0',error:{code:-32000,message:'Origin not allowed'},id:null});
    return;
  }
  next();
});

mcp.post('/', express.json({limit:'16kb'}), async (req, res, next) => {
  const server = new McpServer(serverInfo);
  for (const tool of arcadeTools) {
    server.registerTool(tool.name, {
      description: tool.description,
      inputSchema: {},
      annotations: readOnlyAnnotations
    }, () => toolResult(tool));
  }
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  });
  res.once('close', () => { void server.close(); });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    next(error);
  }
});
mcp.all('/', (_req, res) => {
  res.set('Allow', 'POST').status(405).json({
    jsonrpc:'2.0',error:{code:-32000,message:'Use POST for the stateless MCP endpoint'},id:null
  });
});
