const http = require('http');
const { anthropic } = require('@ai-sdk/anthropic');
const { generateText, tool } = require('ai');
const { z } = require('zod');

// Create a local proxy server
const proxy = http.createServer((req, res) => {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    console.log('--- REQ URL ---', req.url);
    console.log('--- REQ BODY ---');
    console.log(JSON.stringify(JSON.parse(body), null, 2));
    res.writeHead(500);
    res.end('Mock Error');
    process.exit(0);
  });
}).listen(4000, async () => {
  // Override fetch
  const originalFetch = global.fetch;
  global.fetch = (url, options) => {
    const parsed = new URL(url);
    const proxyUrl = 'http://localhost:4000' + parsed.pathname + parsed.search;
    return originalFetch(proxyUrl, options);
  };

  try {
    await generateText({
      model: anthropic('claude-3-5-sonnet-latest'),
      messages: [{role: 'user', content: 'test'}],
      tools: {
        investigate_database: tool({
          description: 'test',
          parameters: z.object({
            search_query: z.string().describe('test')
          }),
          execute: async () => 'test'
        })
      }
    });
  } catch (err) {}
});
