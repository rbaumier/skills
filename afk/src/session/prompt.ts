/**
 * session/prompt.ts — load a phase's prompt template and fill its placeholders.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Effect } from "effect";
import { type Phase, PROMPTS_DIR } from "../config";
import { PromptError } from "./errors";

/** The template file backing each phase. */
const TEMPLATE_FILE: Record<Phase, string> = {
  run_impl: "run-impl.md",
  review: "review.md",
  evaluate: "evaluate.md",
  fix: "fix.md",
  run_dogfood: "run-dogfood.md",
};

/** A `{placeholder}` token — lowercase letters and underscores between braces. */
const PLACEHOLDER = /\{[a-z_]+\}/g;

/**
 * Read the `phase` template and substitute every `{placeholder}` from
 * `replacements`.
 *
 * Fails with {@link PromptError} if the template cannot be read, or if any
 * `{placeholder}` is left unresolved — a literal `{worktree}` reaching the
 * claude session would be a silently wrong prompt, caught here instead.
 */
export const renderPrompt = (
  phase: Phase,
  replacements: Record<string, string>,
): Effect.Effect<string, PromptError> =>
  Effect.gen(function* () {
    const template = yield* Effect.tryPromise({
      try: () => readFile(join(PROMPTS_DIR, TEMPLATE_FILE[phase]), "utf8"),
      catch: (cause) =>
        new PromptError({
          phase,
          reason: `could not read the ${phase} template: ${String(cause)}`,
        }),
    });

    let rendered = template;
    for (const [key, value] of Object.entries(replacements)) {
      rendered = rendered.replaceAll(`{${key}}`, value);
    }

    const unresolved = rendered.match(PLACEHOLDER);
    if (unresolved !== null) {
      const distinct = [...new Set(unresolved)].join(", ");
      return yield* Effect.fail(
        new PromptError({ phase, reason: `template has unresolved placeholders: ${distinct}` }),
      );
    }
    return rendered;
  });
