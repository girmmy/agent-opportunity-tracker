# Opportunity Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build linked and standalone task management, contacts, activity history, and offer decisions into the opportunity tracker.

**Architecture:** Preserve `opportunities` as the primary record and add three RLS-protected tables for tasks, contacts, and append-only activity. Server routes provide browser-session CRUD; the existing agent endpoint gains only expressly allowlisted opportunity fields. Pages use server loading with focused client views, and the opportunity dialog includes linked-work panels.

**Tech Stack:** Next.js 16 App Router, TypeScript, React 19, Supabase/Postgres, Tailwind v4, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-18-opportunity-workspace-design.md`

## Global Constraints

- Preserve the single-user, service-role-only model: every new table has RLS and no permissive browser policies.
- Use additive, idempotent database migrations; existing opportunity rows must remain valid.
- Keep the bearer-token agent boundary limited to explicit opportunity fields; never expose contacts or profile writes.
- Do not delete linked work when an opportunity/contact is deleted; foreign keys use `ON DELETE SET NULL`.
- Use Vitest and demonstrate every behavior with a failing test before production implementation.

---

### Task 1: Test harness and workspace domain types

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `lib/workspace.ts`
- Create: `tests/workspace.test.ts`

**Interfaces:**
- Produces `Task`, `Contact`, `Activity`, `TaskStatus`, `TaskPriority`, `ActivityKind`, `DecisionDetails`, `sortTasks(tasks, today)` and `completeTask(task, at)` for routes and views.

- [ ] **Step 1: Write the failing domain tests**

```ts
import { completeTask, sortTasks } from '@/lib/workspace';

test('sortTasks puts overdue open work before future work', () => {
  expect(sortTasks([
    { id: 'future', title: 'Future', status: 'Open', priority: 'High', due_date: '2026-08-22' },
    { id: 'late', title: 'Late', status: 'Open', priority: 'Low', due_date: '2026-08-17' },
  ], '2026-08-18').map((task) => task.id)).toEqual(['late', 'future']);
});

test('completeTask records the completion time', () => {
  expect(completeTask({ id: '1', title: 'Send', status: 'Open' }, '2026-08-18T14:00:00Z'))
    .toMatchObject({ status: 'Done', completed_at: '2026-08-18T14:00:00Z' });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- workspace.test.ts`

Expected: FAIL because the test runner and workspace module do not yet exist.

- [ ] **Step 3: Add Vitest and minimal domain module**

Add a `test` script using `vitest run`, configure `@` alias resolution, then define the exported unions/interfaces and pure ordering/completion functions in `lib/workspace.ts`.

- [ ] **Step 4: Run the domain tests to verify they pass**

Run: `npm test -- workspace.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts lib/workspace.ts tests/workspace.test.ts
git commit -m "feat: add workspace domain types"
```

### Task 2: Add durable workspace schema and exports

**Files:**
- Create: `supabase/migrations/0012_opportunity_workspace.sql`
- Modify: `scripts/export.mjs`
- Test: `tests/workspace-schema.test.ts`

**Interfaces:**
- Consumes: workspace types from Task 1.
- Produces `tasks`, `contacts`, and `activity` tables plus nullable `next_action`, `next_action_due`, `fit_rationale`, and `decision_details` columns on `opportunities`.

- [ ] **Step 1: Write failing migration assertions**

```ts
test('workspace migration protects personal tables and preserves linked work', async () => {
  const sql = await readFile('supabase/migrations/0012_opportunity_workspace.sql', 'utf8');
  expect(sql).toContain('create table if not exists tasks');
  expect(sql).toContain('on delete set null');
  expect(sql).toContain('alter table tasks enable row level security');
  expect(sql).toContain('add column if not exists fit_rationale text');
});
```

- [ ] **Step 2: Run the migration test to verify it fails**

Run: `npm test -- workspace-schema.test.ts`

Expected: FAIL because migration `0012` is missing.

- [ ] **Step 3: Implement the idempotent migration and export additions**

Create tables with UUIDs, validations, timestamps and update triggers. Grant `service_role` CRUD only. Add all tables to the snapshot export with opportunities.

- [ ] **Step 4: Run the migration test to verify it passes**

Run: `npm test -- workspace-schema.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0012_opportunity_workspace.sql scripts/export.mjs tests/workspace-schema.test.ts
git commit -m "feat: add opportunity workspace schema"
```

### Task 3: Session-authenticated workspace APIs

**Files:**
- Create: `app/api/tasks/route.ts`
- Create: `app/api/tasks/[id]/route.ts`
- Create: `app/api/contacts/route.ts`
- Create: `app/api/contacts/[id]/route.ts`
- Create: `app/api/activity/route.ts`
- Create: `lib/workspace-data.ts`
- Test: `tests/workspace-validation.test.ts`

**Interfaces:**
- Consumes: `Task`, `Contact`, `Activity` types from Task 1 and `requireSession`.
- Produces validated CRUD handlers. Task PATCH transitions to `Done` use `completeTask`; activity supports create/list only.

- [ ] **Step 1: Write failing validation tests**

```ts
import { parseTaskInput } from '@/lib/workspace-data';

test('parseTaskInput rejects a blank title', () => {
  expect(parseTaskInput({ title: '   ' }).success).toBe(false);
});

test('parseTaskInput accepts a standalone task', () => {
  expect(parseTaskInput({ title: 'Refresh portfolio', priority: 'High' }).success).toBe(true);
});
```

- [ ] **Step 2: Run the validation tests to verify they fail**

Run: `npm test -- workspace-validation.test.ts`

Expected: FAIL because parsers do not exist.

- [ ] **Step 3: Implement parsers and routes**

Use Zod to parse bounded string fields, ISO dates, UUID relationships and enum values. Require a session on each route. GET routes order deterministically; mutation routes return the saved row or field-level 400 JSON. Activity PATCH/DELETE routes are intentionally absent.

- [ ] **Step 4: Run the validation tests to verify they pass**

Run: `npm test -- workspace-validation.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/tasks app/api/contacts app/api/activity lib/workspace-data.ts tests/workspace-validation.test.ts
git commit -m "feat: add authenticated workspace APIs"
```

### Task 4: Extend opportunity records safely

**Files:**
- Modify: `lib/types.ts`
- Modify: `app/api/opportunities/route.ts`
- Modify: `app/api/opportunities/[id]/route.ts`
- Modify: `app/api/agent/opportunities/route.ts`
- Test: `tests/agent-allowlist.test.ts`

**Interfaces:**
- Consumes: `DecisionDetails` from Task 1.
- Produces `next_action`, `next_action_due`, `fit_rationale`, `decision_details` on `Opportunity` and server allowlists.

- [ ] **Step 1: Write a failing agent allowlist test**

```ts
test('agent payload permits fit evidence but rejects contacts', () => {
  expect(agentWritableFields).toContain('fit_rationale');
  expect(agentWritableFields).not.toContain('email');
  expect(agentWritableFields).not.toContain('contact_id');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- agent-allowlist.test.ts`

Expected: FAIL because new fields are not represented in the allowlist.

- [ ] **Step 3: Add fields and status activity append**

Extend browser and agent allowlists with only the four opportunity extensions. When browser status changes, append an immutable `Status change` activity entry containing old and new states. Keep existing upsert identity unchanged.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- agent-allowlist.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts app/api/opportunities app/api/agent/opportunities tests/agent-allowlist.test.ts
git commit -m "feat: enrich opportunity records"
```

### Task 5: Build Tasks and Contacts views

**Files:**
- Create: `app/tasks/page.tsx`
- Create: `components/TasksView.tsx`
- Create: `app/contacts/page.tsx`
- Create: `components/ContactsView.tsx`
- Modify: `components/TopBar.tsx`
- Modify: `lib/data.ts`

**Interfaces:**
- Consumes: Task and Contact API payloads, opportunities for optional association.
- Produces responsive `/tasks` and `/contacts` pages with create/edit/complete controls and association labels.

- [ ] **Step 1: Write failing component behavior tests**

```ts
test('task view presents standalone and linked task labels', () => {
  expect(taskContext({ opportunity_id: null }, [])).toBe('Personal');
  expect(taskContext({ opportunity_id: 'op1' }, [{ id: 'op1', organization: 'Acme', role: 'Intern' }]))
    .toBe('Acme · Intern');
});
```

- [ ] **Step 2: Run the component tests to verify they fail**

Run: `npm test -- workspace-view.test.ts`

Expected: FAIL because context formatter/view components do not exist.

- [ ] **Step 3: Implement focused, mobile-safe views**

Add navigation tabs; load server data and give clients optimistic save/complete flows with visible errors. Task defaults to open items and provides a completed toggle. Contacts support search and opportunity linking.

- [ ] **Step 4: Run the component tests to verify they pass**

Run: `npm test -- workspace-view.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/tasks app/contacts components/TasksView.tsx components/ContactsView.tsx components/TopBar.tsx lib/data.ts tests/workspace-view.test.ts
git commit -m "feat: add task and contact workspaces"
```

### Task 6: Opportunity workspace, decisions, and overview

**Files:**
- Create: `app/decisions/page.tsx`
- Create: `components/DecisionsView.tsx`
- Modify: `components/OpportunitiesView.tsx`
- Modify: `app/page.tsx`
- Create: `components/NextActions.tsx`

**Interfaces:**
- Consumes: tasks/activity/contacts loaded by task 3 and opportunity extensions from task 4.
- Produces linked workspace panels, decision list, and an overview that prioritizes urgent tasks/next actions.

- [ ] **Step 1: Write a failing decision eligibility test**

```ts
test('decision rows include an offer and any record with decision details', () => {
  expect(isDecisionRow({ status: 'Offer Received', decision_details: {} })).toBe(true);
  expect(isDecisionRow({ status: 'Waiting for Response', decision_details: { location: 'NYC' } })).toBe(true);
  expect(isDecisionRow({ status: 'Waiting for Response', decision_details: {} })).toBe(false);
});
```

- [ ] **Step 2: Run the decision test to verify it fails**

Run: `npm test -- decisions.test.ts`

Expected: FAIL because decision selector does not exist.

- [ ] **Step 3: Implement linked detail panels and decision dashboard**

Show and create linked tasks/activity/contacts in the opportunity dialog. Add fit rationale and decision fields. Add `/decisions`, filtering opportunities with offers or meaningful decision details. Add an Overview “Act next” section using overdue/due tasks and explicit next actions before the pipeline.

- [ ] **Step 4: Run the decision test to verify it passes**

Run: `npm test -- decisions.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/decisions components/DecisionsView.tsx components/OpportunitiesView.tsx app/page.tsx components/NextActions.tsx tests/decisions.test.ts
git commit -m "feat: connect opportunity workspaces and decisions"
```

### Task 7: Document and verify the complete workspace

**Files:**
- Modify: `README.md`
- Modify: `skill/SKILL.md`
- Modify: `WORKING-WITH-AN-AGENT.md`

**Interfaces:**
- Consumes: all completed application behavior.
- Produces accurate deployment/migration notes and agent rules for fit rationale and next actions.

- [ ] **Step 1: Update docs**

Document workspace tabs, standalone task behavior, personal-data boundary, the fit-rationale and next-action fields, and the unchanged restriction against agents touching contacts/standalone tasks.

- [ ] **Step 2: Run complete automated verification**

Run: `npm test && npm run typecheck && npm run build`

Expected: all commands exit 0.

- [ ] **Step 3: Manually verify responsive flows**

Run: `npm run dev`

Verify on desktop and 375px viewport: navigation; standalone task creation/completion; linked task display; contact creation; opportunity status history; offer decision details; and Overview ordering.

- [ ] **Step 4: Commit**

```bash
git add README.md skill/SKILL.md WORKING-WITH-AN-AGENT.md
git commit -m "docs: explain opportunity workspace"
```
