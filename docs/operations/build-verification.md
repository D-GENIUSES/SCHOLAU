# Build and runtime verification

Verified on 18 October 2026 using Node.js 24 and pnpm 12.11.2 in an isolated checkout of the pull request branch.

## Corrections

- `AdminQuestion` now declares `answer_format` and nullable `battle_seconds`, matching the existing `admin_get_question_v1` SQL response and database constraints.
- Lecturer application lists use TanStack Query with filter, search, and page-specific keys instead of synchronous state updates from an effect. Manual refresh remains available.
- Expired-session navigation uses Next.js `router.replace` while preserving the requested destination.

## Results

| Check | Result |
| --- | --- |
| Frozen dependency installation | Passed. |
| `pnpm lint` | Passed for all four workspaces, without warnings. |
| `pnpm typecheck` | Passed for all four workspaces. |
| `pnpm build` | Passed; Next.js completed production compilation, type checking, and generation of 47 pages. |
| Production server | Started successfully on `127.0.0.1:3128`. |
| Browser smoke checks | 15 passed: five public pages, six protected-route redirects, three API access guards, and mobile sign-in overflow. No browser page errors. |
| Lecturer list regression | Five isolated browser checks passed: initial loading, status filtering, empty results, service errors, and recovery. No browser page errors. |

The production server was started with `pnpm --filter @scholau/web start --hostname 127.0.0.1 --port 3128`. Browser checks used headless Microsoft Edge. Lecturer-list checks used mocked API responses and the actual component.

## Scope

These checks confirm buildability, startup, public rendering, anonymous access guards, and lecturer-list UI behavior. Authenticated workflows against a live Supabase project were not exercised. No production credentials were copied into this checkout, and no database migrations or live data were changed.
