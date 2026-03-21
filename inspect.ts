import { streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

async function main() {
  const result = streamText({
    model: anthropic('claude-3-haiku-20240307'),
    prompt: "hi"
  });
  console.log("Keys:", Object.keys(result));
  for (let key in result) {
      if (typeof (result as any)[key] === 'function') console.log("Function:", key);
  }
}
main().catch(console.error);
