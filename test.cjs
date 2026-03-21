const ai = require("ai");
const anthropic = require("@ai-sdk/anthropic").anthropic;

const result = ai.streamText({
    model: anthropic('claude-3-haiku-20240307'),
    prompt: "hi"
});
console.log("METHODS ON RESULT:", Object.keys(result));
for (let key in result) {
    if (typeof result[key] === 'function') console.log("FUNC:", key);
}
