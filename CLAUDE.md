# Agent instructions

## Read docs/ first

- `docs/` is the source of truth. Start every task by listing its contents.
- Always read section 7.5 of `docs/specifications.md` in full (rules CODE-01 to CODE-16).
- Before any task that touches the front, read `docs/graphic-charter.md` in full (rules CHG-01 to CHG-105).
- For everything else, read only the sections of `docs/` relevant to the task.

## Apply the CODE and CHG rules

- Apply the CODE rules everywhere and the CHG rules wherever they apply.
- `eslint-disable` directives, allowed by CODE-03, require my explicit approval each time.

## Never bypass the controls

The controls are the Git hooks, ESLint, Prettier, the typecheck, the forbidden-character scan, commitlint, the tests and the CI. When one fails, fix the cause. The following are bypasses and are forbidden: you may propose one with its justification, but act only after my explicit approval, case by case.

- Skipping hooks: `git commit --no-verify`, `SKIP_SIMPLE_GIT_HOOKS=1`, uninstalling or editing the hooks.
- Weakening a control's configuration (ESLint, `tsconfig`, commitlint, Prettier, the scan script, the CI workflows, the coverage threshold) to make it pass. Creating these configurations as specified in `docs/` is not weakening them.
- Neutralizing tests: `.skip`, `.only`, deleting a test or weakening an assertion to get green.
- Bypassing the CI: direct push or force push to `main`, which triggers deployment, or re-running a flaky test until it passes.

## When in doubt, ask

If you have the slightest doubt about an implementation decision, ask me before continuing. Using the AskUserQuestion tool, ask me questions until no doubt remains, however many questions it takes.

This also covers any ambiguity in `docs/`, any contradiction between two requirements and any gap between `docs/` and the code: never settle it yourself.
