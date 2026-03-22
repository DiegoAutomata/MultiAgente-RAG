const { z } = require('zod');
const { zodToJsonSchema } = require('zod-to-json-schema');

const schema = z.object({ search_query: z.string().describe("desc") });
console.log(JSON.stringify(zodToJsonSchema(schema), null, 2));
