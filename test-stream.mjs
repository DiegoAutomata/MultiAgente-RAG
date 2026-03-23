import { streamText } from 'ai';
console.log("Keys in streamText:", Object.keys(streamText({ model: { specificationVersion: "v1", provider: "mock", modelId: "mock", doStream: async () => ({ stream: new ReadableStream(), rawCall: {} }) } as any, prompt: "test"})));
