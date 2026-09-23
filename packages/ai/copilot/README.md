# Copilot — future extraction point

The MVP has no conversational copilot. It is intentionally not added during the architecture refactor. A future copilot must consume authorized, structured domain context and return validated text. It must not read repositories, change skills, recalculate scores, or write audit/database records directly.

The existing explanation context builder at `../explainability/context-builder.ts` demonstrates the data minimization pattern. Backend authorization must prepare any future manager or employee context before calling an AI module.
