const express = require('express');

process.env.HOUSE_ARCADE_HOSTED = '1';

async function start() {
  const { handleRequest } = await import('./raffle/server.mjs');
  const { mcp } = await import('./raffle/mcp.mjs');
  const app = express();
  app.disable('x-powered-by');
  app.use('/mcp', mcp);
  app.use(handleRequest);
  app.listen(Number(process.env.PORT || 14173), '0.0.0.0');
}

start().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
