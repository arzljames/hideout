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
- A Conventional Commit message and PR description (do not commit or push unless I ask)
