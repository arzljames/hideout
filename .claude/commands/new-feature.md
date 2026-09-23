---
description: Plan and build a new frontend feature end to end (routes, UI, data, tests, reviews)
argument-hint: <feature description, e.g. "pinned messages panel in text channels">
---

# New feature (hideout-web): $ARGUMENTS

If no feature description was given above, ask me for one and stop.

Follow `CLAUDE.md`. Work through the phases in order. Do not skip the approval checkpoint.

## Phase 1: Understand

1. Restate the feature in one or two sentences from the user's point of view, including which roles see it.
2. Run `npm run gen:api` so the contract is current, then check `src/lib/api/schema.d.ts` for every endpoint and field the feature needs.
3. **If anything is missing from the contract, stop here.** Write an API request for hideout-api (method, path, auth, request, response, error codes, and why) that I can paste into `/new-feature` in that repo. Don't mock or invent the shape.
4. Read the related routes in `src/routes/`, the feature folder in `src/features/`, and the ui components in `src/components/ui/`.
5. List open questions (placement in the UI, empty states, mobile behavior, permissions). Ask anything that would change the design and wait for answers.

## Phase 2: Plan (approval checkpoint)

Write a plan with these sections, then **stop and wait for my approval** before changing any files:

- **Routes:** new or changed route files, with `validateSearch`, `beforeLoad` guards, loaders (`ensureQueryData` + `queryOptions`), `pendingComponent`, `errorComponent`, and `notFound()` handling.
- **Data:** queries and mutations in the feature's `api.ts`, query keys, cache invalidation or optimistic updates, and any Realtime subscription changes.
- **UI:** components to build, which shadcn components they use, any shadcn components to add with the CLI, and any new `cva` variants.
- **States:** loading, empty, error, offline, and permission-denied for each view; desktop and mobile (below `md`) layouts; light and dark themes.
- **Accessibility:** keyboard flow, focus management, labels, and live regions.
- **Tests:** the behaviors that will be tested.
- **Files:** expected files to create or change.
- **Branch:** `feat/<short-kebab-name>`.

## Phase 3: Build (after approval)

1. Create the branch: `git switch -c feat/<short-kebab-name>`.
2. Add any needed shadcn components with `npx shadcn@latest add <name>` (ask before running).
3. Delegate UI, routes, and data to `frontend-engineer` with the Routes, Data, UI, States, and Accessibility sections.
4. Delegate LiveKit or Supabase Realtime work to `voice-realtime-engineer`.
5. Delegate tests to `test-engineer` with the Tests section.
6. Run `npm run typecheck && npm run lint && npm run test && npm run build`. Fix failures before continuing.

## Phase 4: Review

1. Run `code-reviewer`.
2. Run `security-reviewer` if the feature renders user content, handles auth or redirects, touches Supabase/LiveKit tokens, or adds dependencies or env vars.
3. Fix every **Must fix** and **Critical/High** finding, then re-run the checks from Phase 3 step 6.

## Phase 5: Hand off

Finish with a summary containing:

- What was built, with the routes and main components
- Verification results (commands and outcomes)
- Review verdicts and anything deferred
- Manual QA checklist: the flows to click through in both themes and on a mobile viewport
- A Conventional Commit message and PR description

End by asking whether to commit, push, and open the PR. **Stop and wait for my answer.**

## Phase 6: Commit and PR (after I confirm)

1. Check `git status` and `git diff --stat`. Stage only this feature's files, never `.env*`, `dist/`, or `test-results/`. If there's anything unrelated, ask before including it.
2. Make sure you're on the feature branch, not `main`.
3. Commit with the Conventional Commit message from Phase 5, e.g. `feat(<feature>): <summary>`, with a short bullet body. Use one commit per feature unless I ask for more.
4. Push with `git push -u origin <branch>`.
5. Open the PR against `main` with `gh pr create --base main --title "<commit subject>" --body-file <file>`, using the Phase 5 PR description written to a scratch file. The PR description needs these sections:
   - **Summary**
   - **Deferred**
   - **Testing** (the commands from Phase 3 step 6 and their results, plus anything not run and why)
   - **Manual QA** (the checklist from Phase 5)
6. If `gh` isn't installed or authenticated, don't install it. Give me the compare URL (`https://github.com/<owner>/<repo>/pull/new/<branch>`) and the PR description to paste.
7. Report the commit hash, the pushed branch, and the PR URL. Never force-push, amend pushed commits, or merge.
