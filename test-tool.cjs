const { anthropic } = require('@ai-sdk/anthropic');
const { generateText, tool } = require('ai');
const { z } = require('zod');
require('dotenv').config({ path: '.env' });

async function main() {
  try {
    const result = await generateText({
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
    console.log("Success:", result.text);
  } catch (err) {
    console.error("Error:", err.message);
    console.error("Details:", JSON.stringify(err, null, 2));
  }
}
main();
