# QA loop (onboarding graph)

The **`qa_loop`** node is the interactive Q&A step in the onboarding LangGraph. A new hire asks questions about the project; the agent answers using only the persisted onboarding artifacts (no vector DB).

## Behavior

1. **Pause for input** — The node calls `interrupt()` so the graph pauses and the frontend can send the user’s question.
2. **Load context** — From the session store it loads:
   - Interview summary (`interview_summary.txt`)
   - Global text summary (`text_summary.txt`)
   - Knowledge graph (`knowledge_graph.json`)
   - Deep dives (`deep_dives.txt`)
3. **Answer** — `QA_SYSTEM_PROMPT` is filled with that context and the user question. The LLM is called with this as the system prompt and `state["chat_history"]` as messages. Responses must cite artifacts (e.g. `[Deep Dive: file.py]`, `[KG]`) and say when the artifacts don’t contain the answer.
4. **Update state** — The new user message and assistant reply are appended to `chat_history`; `current_mode` is set to `"qa"`.
5. **Loop** — The graph has an edge from `qa_loop` back to `qa_loop`, so after each answer it waits again for the next question.

## State

- **Reads:** `session_id`, `chat_history`, session storage (artifacts above).
- **Writes:** `chat_history`, `current_mode` (`"qa"`).

## Interrupt payload

When the graph is resumed after `interrupt()`, the frontend must send the value that was passed to `interrupt()` (e.g. the user’s question string). That value is used as `user_input` in the prompt.

## Prompt and citations

The agent is instructed to cite one of: `[Interview Summary]`, `[Text Summary]`, `[KG]`, `[Deep Dive: <file or section>]` for each claim, and to say “I don’t have specific information on …” when the artifacts don’t cover the topic. See `QA_SYSTEM_PROMPT` in `onboarding_graph.py` for the full rules.
