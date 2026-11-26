import {arcadeTools, emptyInputSchema, readOnlyAnnotations, toolResult} from '/arcade-agent-data.mjs';

const context = [document.modelContext, navigator.modelContext]
  .find(candidate => typeof candidate?.registerTool === 'function');

if (context) {
  for (const tool of arcadeTools) {
    try {
      Promise.resolve(context.registerTool({
        name: tool.name,
        description: tool.description,
        inputSchema: emptyInputSchema,
        annotations: readOnlyAnnotations,
        execute: () => toolResult(tool)
      })).catch(error => console.warn('Unable to register Arcade WebMCP tool', tool.name, error));
    } catch (error) {
      console.warn('Unable to register Arcade WebMCP tool', tool.name, error);
    }
  }
}
