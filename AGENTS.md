# AGENTS.md

Conventions for AI agents (opencode, etc.) working on this repository.

## Cleanup routine (mandatory)

After the implementation phase of any plan completes, delete every plan file that
was saved **outside the codebase** (e.g. `~/.local/share/opencode/plans/*.md`
on the host, or `/root/.local/share/opencode/plans/*.md` inside WSL) before
signing off. Do not leave stray plan files behind. Plan files saved **inside**
the repository (e.g. `.opencode/plans/*.md`) are part of the codebase and are
not subject to this rule.

If a plan is later abandoned without implementation, still delete the
out-of-codebase plan file at the end of the session.

## Project context

- Word-to-HTML converter is implemented in `src/lib/word-to-html/`.
  See `validator.ts` for the validation pipeline used by the
  `WordToHtmlConverter` UI tool.
- Validation pipeline rule IDs are stable string identifiers surfaced to the
  UI — adding a new validator means also extending the warning-mapping loop in
  `src/components/tools/WordToHtmlConverter.tsx` if you want UI highlights.
- Tests run with `npm install && npm run test` (vitest, jsdom).
