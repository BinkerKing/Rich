# Rich AI Memory Framework Notes

## Goal

Rich needs model-agnostic context: normal chat should remember prior turns, and task agents should remember user preferences, project state, and reusable work patterns. The storage of source data must stay inside Rich; external memory frameworks should be replaceable strategy layers.

## Current Decision

Do not introduce a heavy framework immediately. Keep this boundary:

- Rich owns raw data: chat messages, project data, manuals, model route settings, and future task run records.
- Rich owns scenario routing: `chat`, `analysis`, `project-practice`, `agent-task`, `coding`, and other scenarios pick providers through `modelRouter`.
- Memory frameworks may own derived recall: summary extraction, semantic memory, preference memory, and task memory.

The first implementation is intentionally small:

- `chat_messages` is the source-of-truth transcript.
- `chat_conversation_summaries` is a derived rolling summary.
- `/api/chat` and `/api/chat/stream` inject summary + recent messages + current input.
- Summary refresh uses the `analysis` scenario, so the compression model can be changed without changing chat storage.

## Framework Options

| Option | Best Use In Rich | Fit |
| --- | --- | --- |
| LangGraph persistence | Resumable multi-step agent workflows, task state, approvals, durable tool loops | Strong for future Agent 调度层 |
| LangMem | Extracting durable memories from conversations and optimizing prompts over time | Strong for user preference / behavior memory |
| Mem0 | Fast external long-term memory layer across sessions and agents | Good if we accept a managed/additional memory dependency |
| OpenAI Agents SDK sessions | Agent loop, tools, handoffs, tracing, session memory | Good if Rich standardizes agent orchestration around OpenAI-compatible agent runs |

## Recommended Path

1. Keep the current Rich context engine as the stable internal contract.
2. Add a memory provider interface later:

```ts
interface MemoryProvider {
  recall(input: { userId: string; scenario: string; query: string }): Promise<string[]>;
  observe(input: { userId: string; scenario: string; messages: unknown[] }): Promise<void>;
}
```

3. Start with no-op/internal summary provider.
4. Add one external provider behind env flags only after behavior is proven useful.
5. For task execution, evaluate LangGraph or OpenAI Agents SDK separately from chat memory. Task orchestration and memory are related, but they should not be one tangled module.

## Practical Rules

- Never store API keys, token-plan installer commands, or provider credentials in Git.
- Never delete raw chat messages because a summary exists.
- Never make Hermes the only source of memory. Hermes, Codex, Bailian, and future providers must all use the same Rich context layer.
- If a business AI entrypoint depends on specific project data, pass that project data explicitly instead of relying on unrelated chat history.
- Use chat history for user conversational continuity; use project/database context for factual work.

## References

- LangGraph persistence: https://docs.langchain.com/oss/python/langgraph/persistence
- LangChain long-term memory: https://docs.langchain.com/oss/python/langchain/long-term-memory
- LangMem: https://langchain-ai.github.io/langmem/
- Mem0 docs: https://docs.mem0.ai/introduction
- OpenAI Agents SDK: https://openai.github.io/openai-agents-python/
