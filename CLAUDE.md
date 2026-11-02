# Cable Splice Planner | Claude Code Project Instructions

> Status: PROJECT SPECIFICATION. The application is not built. This document governs planning, interviews, implementation, testing, and field validation.
> Priority: Accurate pair/fiber identity over convenience or visual polish.

## 0. Mandatory Start: PLAN + INTERVIEW, BEFORE WRITING CODE

**First action in every new Claude Code implementation session:** enter or remain in Plan Mode. If the session is not already in Plan Mode, ask the operator to select Plan Mode or start Claude Code using `claude --permission-mode plan`. Do not attempt to switch permission modes through a shell command inside the session.

**Required sequence:**
1. Inspect this file and the existing repository using read-only operations.
2. State assumptions, constraints, unanswered questions, and the initial proposed milestones.
3. Conduct an interactive requirements interview. **Use the built-in `AskUserQuestion` tool when available.** Ask focused batches of up to four questions, with concrete options and an Other/custom response when supported. Follow each batch with a short summary. Where the tool is unavailable, ask the same questions in ordinary conversation and record the answers. Never pretend the tool ran.
4. Do not silently choose ambiguous cable counts, numbering traditions, mappings, directionality, or safety-critical defaults. Mark them **UNRESOLVED** until the user provides evidence or an explicit decision.
5. Capture answers in `docs/decisions/requirements.md`, `docs/decisions/adr-*.md`, and `docs/plan.md` **after** write permission is granted. During Plan Mode, present proposed contents in the conversation or use the session's approved planning mechanism, not source-file edits.
6. Produce architecture, data contract, milestones, risk register, acceptance criteria, and test matrix. Present the plan for operator approval.
7. **Approval gate:** explicitly ask the operator to approve the plan and select an execution mode. No implementation work before approval.
8. **Only after approval:** use Manual/acceptEdits or Auto Mode if supported. The operator switches mode through Claude Code controls or starts a new session with the appropriate flag. Never assume a plan approval itself changed permissions.
9. `--dangerously-skip-permissions` (bypass permissions) is **opt-in only**, requires separate explicit permission, and is limited to an isolated, disposable container/VM with no secrets, production credentials, or sensitive mounts. Never switch to it automatically or set it as a project default. Prefer Auto Mode with sandbox isolation.
10. If the operator changes requirements during implementation, return to planning for the affected workstream before continuing.

### Required interview, in order
**Round A: Users and field conditions**
- Who uses the app: ILEC/OSP copper splicers, fiber splicers, contractors, supervisors, trainees? Which regions and company rules apply?
- Target platforms: phone, tablet, desktop, web/PWA; offline jobsite support and sync requirements?
- Main outcome: quick count lookup, full splice plan, as-built mapping, training aid, or all four?
- Which real jobs must MVP complete, end to end? Request at least three anonymized work examples.

**Round B: Copper conventions**
- Relevant materials and construction: pulp/PIC, aerial/buried, twisted pair, binder/super-binder, screened cables, special purpose arrangements?
- Which legacy count conventions exist in the user's system? Request photographs, engineering sheets, numbered examples, and company-approved tables. Do not invent a legacy standard.
- Do cable appearances (CA), local vs absolute pair count, binder offsets, reversed orientations, split pairs, counts that restart, tie pairs, spare/working pairs, and 25-pair groups matter?
- Need for bridge taps, straight splices, branches, transfers, pair swaps, rearrangements, and multi-cable splice cases?

**Round C: Fiber conventions**
- Loose tube, ribbon, rollable ribbon, central tube, micro-cable, distribution/drop, 12F and 24F arrangements, manufacturer-specific identifiers?
- Which color-code references and revisions are required? How do tube, ribbon, subunit, fiber and trace markings repeat?
- Direction of count, head/end orientation, ring/route labeling, sheath IDs, tube positions, tray/cassette positions, dark/spare fibers?
- Types of work: straight-through, mid-span, breakout, branch, cutover, cross-connect, re-route, split/splice schedule; is PON splitter documentation required?

**Round D: Outputs, controls, and delivery**
- Text style: individual connections, range summary, splice sheet, cable-by-cable schedule, label output?
- Visuals: colored pair diagrams, binder/tube/ribbon views, two-sided splice lines, interactive zoom, printable pages, QR IDs?
- Do exports require PDF, CSV, JSON, printed work packages, or imported field notes?
- Roles, approvals, audit trail, local-only vs cloud storage, record retention, and error reporting?

**Interview stop condition:** unresolved answers affecting physical mappings block release of the associated capability. Record optional questions for later, but do not fill gaps with guessed mapping rules.

## 1. Product Objective
Build a mobile-first field application for copper and optical-fiber cable splicers. Operators enter the identity, construction, numbering system, counts, segment orientation, and desired connection pattern of each cable. The app returns:
- An **exact, auditable source-to-destination connection list**, with locally meaningful and absolute identities.
- Color-coded and labeled diagrams accurately derived from the **same canonical mapping** as the text output.
- Warnings for missing identifiers, ambiguous legacy rules, mismatched capacity, duplicate assignments, out-of-range counts, and incompatible choices.
- An editable, versioned splice plan and printable/exportable documentation.

A polished screen never overrides count correctness. The app is a planning/reference aid. Field teams must verify actual cable identity and physical markings before work, especially during live-network cutovers.

## 2. Scope and Staged Delivery
### MVP, subject to interview
- Create/select job, cable, cable segment and splice case.
- Copper: standard 25-pair color-code lookup, groups/binders, offsets and start/end ranges.
- Fiber: standard 12-color reference, configurable tubes/ribbons/subunits and fiber ranges.
- One-to-one straight splice and explicit remap (legacy-to-modern using user-approved profiles).
- Two-sided text schedule and corresponding visual with no independently calculated labels.
- Warning system, field confirmation, saved plan, JSON/CSV export, offline read/edit where approved.

### Later phases
- Branch/multi-cable splice, re-entry, mid-span, transition, split and merge planning.
- Copper rearrangements, transfers, bridge taps and working/spare status.
- Fiber tray mapping, cassette mapping, equipment endpoints, cross-connects, PON-specific documentation.
- PDF print package, import templates, historical compare/rollback, supervisor approval, syncing.

**Out of initial scope unless approved:** automated optical loss engineering, live test equipment integration, remote network control, AI-generated physical count assumptions, and universal support for unidentified legacy schemes.

## 3. Non-Negotiable Accuracy Rules
1. **Separate identities:** physical position, cable-local displayed number, absolute network identifier, and color/marking are distinct fields.
2. **Explicit profiles:** standard and legacy conventions live in named, versioned `CountProfile` definitions with provenance, applicable region/company, effective dates where relevant, and reviewed examples.
3. **No offset assumptions:** a profile-to-profile mapping needs a known physical-position correlation or an explicit approved mapping table. A matching displayed number does not prove a matching conductor/fiber.
4. **No implicit 1-to-1 when counts differ:** preserve spare/unassigned entries and report capacity issues. Never silently discard unmatched endpoints.
5. **No ambiguous repeats:** distinguish repeat colors using tube/binder/ribbon/subunit IDs, position, trace/stripe, and local/absolute numbering.
6. **Never identify solely by color:** human-readable color labels, numeric positions, and source identifiers must accompany swatches.
7. **Orientation is explicit:** A/Z end, head/tail, sequence direction, near/far, and any reversed physical order are modeled, not assumed.
8. **Conductor/fiber integrity:** copper tip/ring roles are preserved; fiber individual identity is preserved. Any polarity/routing semantics require an explicit operation and test.
9. **Same source of truth:** both text and graphics render from `ResolvedSplicePlan`; they do not each recalculate counts.
10. **Fail closed:** unknown, contradictory, undocumented, or out-of-range inputs yield an unresolved state, never an invented splice instruction.
11. **Integer-safe deterministic logic:** use explicit 1-based displayed positions, clear normalization at boundaries, and checked bounds. No floating-point numbering.
12. **Rule provenance:** every mapping result references rule/profile versions and any user overrides.
13. **Physical vs work instruction:** generation of a plan is separate from human approval for field execution.

## 4. Reference Standards and Verification
Use approved official standards or manufacturer documentation as reference, not guessed recollections. Confirm applicability and version with the interview.
- Copper North American examples: 25-pair tip/ring scheme, 25-pair binder groups and 600-pair super-units. See 7 CFR §1755.200 and approved Telcordia/company specifications. Distinguish group position from pair number.
- Fiber North American examples: TIA/EIA-598 12-color identification. Manufacturer-specific construction, tracers, subunits and repeated sequences require separate profiles.
- Baseline fiber color sequence: Blue, Orange, Green, Brown, Slate, White, Red, Black, Yellow, Violet, Rose, Aqua.
- Baseline copper pairing: major colors White, Red, Black, Yellow, Violet; minor colors Blue, Orange, Green, Brown, Slate. One cycle equals 25 unique pair-color combinations, but labeling and binder identity vary by construction.
- Keep sample tables/test fixtures derived from cited, reviewed references. Verify license/access requirements before bundling substantial third-party content.

Reference URLs for review:
- https://www.law.cornell.edu/cfr/text/7/1755.200
- https://www.corning.com/catalog/coc/documents/application-engineering-notes/AEN029.pdf
- https://code.claude.com/docs/en/permission-modes
- https://code.claude.com/docs/en/overview

**Never treat a default color sequence as sufficient to identify a real physical strand.**

## 5. Proposed Technical Architecture (confirm in interview)
Recommended default: TypeScript monorepo using a PWA front end, shared domain logic, local database, and focused tests. Prefer offline-first behavior for field sites. Confirm these selections before generating scaffolding.
- App: React + TypeScript + Vite or Next.js PWA, based on hosting and offline requirements.
- UI: accessible components, responsive touch controls, high-contrast mode, color-blind-friendly labels.
- Visualization: SVG for deterministic, print-ready connector lines, group color bands, zoom and export. Canvas only where performance tests justify it.
- State/forms: schema-validated inputs, versioned domain objects, undo/history.
- Persistence: IndexedDB for local-first storage, optional synced service in a later phase.
- Validation: Zod or equivalent at boundaries; all business rules in pure, separately tested modules.
- Test tooling: Vitest, React Testing Library, Playwright, property-based tests (`fast-check`), TypeScript strict mode, ESLint, formatter.
- Automation: GitHub Actions or equivalent CI running lint, typecheck, unit, integration, E2E and build.
- Optional tooling: PDF export, accessible diagram snapshot checks, seeded test fixtures.

### Proposed repository structure
```text
cable-splice-planner/
├── CLAUDE.md                         # This governing document
├── README.md
├── package.json
├── pnpm-workspace.yaml                # If monorepo is approved
├── .claude/
│   ├── settings.json                 # Project-scoped conservative permissions
│   └── commands/                     # Optional reusable review/test tasks
├── apps/
│   └── field-app/
│       ├── src/
│       │   ├── app/                   # Routes, screens, navigation
│       │   ├── features/
│       │   │   ├── jobs/
│       │   │   ├── cable-inventory/
│       │   │   ├── count-profiles/
│       │   │   ├── splice-designer/
│       │   │   ├── diagrams/
│       │   │   ├── verification/
│       │   │   └── exports/
│       │   ├── components/
│       │   ├── persistence/
│       │   └── styles/
│       └── tests/e2e/
├── packages/
│   ├── domain/                       # Pure domain models and mapping engine
│   │   ├── src/models/
│   │   ├── src/profiles/
│   │   ├── src/copper/
│   │   ├── src/fiber/
│   │   ├── src/mapping/
│   │   ├── src/validation/
│   │   └── tests/
│   ├── reference-data/               # Cited, versioned profile definitions
│   │   ├── standard/
│   │   ├── legacy-approved/
│   │   ├── schemas/
│   │   └── fixtures/
│   ├── diagram-renderer/             # Receives resolved plan, no count math
│   └── export-engine/                # Text, JSON, CSV, optional PDF
├── docs/
│   ├── plan.md
│   ├── architecture.md
│   ├── domain-model.md
│   ├── count-conventions.md
│   ├── verification-matrix.md
│   ├── field-validation.md
│   ├── decisions/
│   │   ├── requirements.md
│   │   └── adr-0001-*.md
│   └── samples/                      # Anonymized operator-approved cases
├── scripts/                          # Integrity and verification helpers
└── .github/workflows/ci.yml
```

## 6. Domain Model and Data Contracts
Define exact runtime schemas and TypeScript types before UI implementation.

- `Job`: id, location reference (optional), owner, status, created/updated time, approval history.
- `Cable`: id, media (`copper` | `fiber`), manufacturer/model where known, construction, nominal count, count profile version, appearance ID, orientation, provenance.
- `CableSegment`: cable ID, segment identifier, local range, absolute range if defined, structure path, physical position and route orientation.
- `CountProfile`: id, version, medium, count base, number display policy, group hierarchy, color rules, repeat/tracer rules, orientation policy, provenance, validation fixtures and approvals.
- `EndpointIdentity`: cable ID + segment ID + hierarchical physical path + physical position + local label + optional network/absolute ID + coloring/markings.
- `SpliceOperation`: straight, remap, branch, transfer, reserved, pass-through, or other explicitly modeled type.
- `Connection`: stable id, exactly identified source endpoint, exactly identified target endpoint, operation type, approval state, status, metadata.
- `ResolvedSplicePlan`: deterministic connections, unassigned endpoints, ambiguities, warnings/errors, source profile versions, hash/version, verification results.
- `VisualNode/VisualEdge`: view-only projection of `EndpointIdentity` and `Connection`, never independent business logic.
- `AuditEvent`: who/when/what before-and-after record, including manual overrides and justifications.

Example: user-visible number `101` on an older appearance and `1` on a newer appearance are **not** assumed equivalent. They link only if a verified physical-position or documented crosswalk explicitly associates the endpoints.

### Engine contracts
- `resolveEndpoint(cable, segment, countProfile, locator) -> ResolvedEndpoint | ValidationError`
- `normalizePhysicalPosition(endpoint, orientation) -> CanonicalPosition`
- `translateEndpoint(sourceEndpoint, targetCable, crosswalk) -> ResolvedEndpoint | UnresolvedMapping`
- `buildSplicePlan(inputs, approvedProfiles, operation) -> ResolvedSplicePlan`
- `validateSplicePlan(plan) -> VerificationReport`
- `renderText(plan) -> SpliceSchedule`
- `renderDiagram(plan) -> DiagramModel`
- `exportPlan(plan, format) -> ExportArtifact`

Pure functions, stable output, no silent fallback. Explicit errors include the relevant cable/profile/group and suggested next verification step.

## 7. User Workflow
1. Start or open a job, identify the work area and splice case.
2. Select copper or fiber, then add two or more cable ends. For each, record sheath/CA ID, count, structure, and orientation.
3. Choose a **verified** count profile for each cable. Show its standard, revision, and any legacy-specific rules.
4. Enter start/end ranges, group/binder/tube/ribbon identity, and requested splice operation.
5. Preview resolved identities before connections. Stop for review when duplicated colors or numbers occur.
6. Construct an explicit mapping. For cross-profile splices, require a physical-position crosswalk or reviewed manual table.
7. Run validation and display errors separately from warnings. Block approval when errors remain.
8. Show synchronized text and visuals, including source and destination, counts, colors/markings, unassigned endpoints, and overrides.
9. Operator confirms against field records and physical markings, then marks verified, signs off, exports, or saves a draft.
10. Save revision history. On any changed input, invalidate dependent verification and regenerate the outputs.

### Display expectations
- **Copper row:** source CA, source pair no., group/binder, tip/ring color labels, destination CA, destination pair no., group/binder, destination tip/ring labels, status.
- **Fiber row:** source sheath, tube/subunit/ribbon, fiber no. and color label, destination sheath, tube/subunit/ribbon, fiber no. and color label, tray/port if supplied, status.
- **Diagram:** labeled cable sides and group boundaries, accessible colored swatches, individual connection lines and stable row IDs. Highlight crossings, missing mappings, and non-standard translations. Zoom to group/range without losing numbering context.
- Include legend, profile revision, cable orientation, timestamp, draft/verified state, and printable count totals.

## 8. Verification-First Build Requirements
**Tests precede or accompany every rule engine change.** Start with operator-verified examples and expected outputs, then implement logic. Keep example evidence in `docs/samples/` and test fixture references in data profiles.

### Required test layers
1. **Reference-data tests:** color sequences, profile bounds, group start/end boundaries and repetition/tracers match reviewed references.
2. **Pure unit tests:** pair/fiber position resolution, group offsets, local vs absolute numbering, orientation reversals, crosswalk lookup, holes and out-of-range input.
3. **Property/invariant tests:** unique stable endpoint IDs; no duplicated destination assignment in one-to-one mode; mapping never changes unexpectedly after render; total assignments plus unassigned equals source inventory; source/destination count mismatch is surfaced.
4. **Round-trip tests:** export/import preserves IDs, profiles, connections, warnings, and version semantics.
5. **Text/diagram parity:** diagram edge IDs and labels match resolved connection IDs and text rows exactly. Both count totals agree.
6. **Integration tests:** job edit -> resolve -> validate -> render -> save -> reopen -> export.
7. **E2E tests:** realistic mobile/touch workflow, offline startup/editing, validation blocking, printing/exporting, keyboard and screen reader.
8. **Golden fixtures:** at least 3 real anonymized copper cases, 3 fiber cases, and 3 legacy-to-modern transitions, reviewed and signed off by an experienced splicer before any field-ready claim.
9. **Regression tests:** every reported count error adds a minimal reproducible fixture before fixing it.

### Boundary fixtures that must exist
- Copper pairs 1, 5, 6, 25, 26, 50, 600, 601 and final profile-supported pair.
- Fiber strands 1, 12, 13, 24, repeated color cycles, group/tube boundary and final supported strand.
- Offset starts at 0 or 1 as defined by imported format, local numbers restarting at 1, non-contiguous legacy count, reversed cable orientation, mirrored diagram.
- One-to-one matching counts, 100-to-50 or other mismatch with unassigned report, duplicates, missing mapping, invalid profile version, swapped tip/ring input, conflicting identifiers.
- Cross-profile example with verified explicit pair/fiber crosswalk plus a similar case **without** crosswalk, expected to block.

### Required verification commands (adapt after stack approval)
```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm test:property
pnpm test:e2e
pnpm build
```
Do not claim these commands work before the project supplies matching scripts. CI runs approved equivalents on each pull request.

### Stop-the-line failures
- Wrong color, identity, binder/tube/ribbon, offset, or mapping.
- Any graphical connection differing from the text schedule.
- A duplicated target in one-to-one mode or unexplained omitted endpoint.
- Missing mapping evidence represented as a confident result.
- Export data differing from a validated plan.
- Failing tests, inaccessible critical identifiers, or unverified safety-relevant behavior.

## 9. Execution Stages and Approval Gates
**Gate 0: Interview & plan**: capture decisions and real reference cases; obtain written plan approval; select permission mode.

**Gate 1: Domain specification**: draft schemas, count profiles, examples, ambiguity/error taxonomy; operator reviews field terms and mapping rules.

**Gate 2: Accuracy core**: implement pure copper/fiber resolvers, crosswalk and plan validation, with golden tests. No UI beyond test harness.

**Gate 3: Core application**: cables/jobs/forms, responsive views, simple splice workflow; tests on desktop and phone screen sizes.

**Gate 4: Visuals + exports**: derive diagrams and reports from same plan object; automated text/visual/export parity tests.

**Gate 5: Field review**: experienced splicers compare anonymized real cases, photographs, cable records, visual layout, printouts. Record deviations as issues, fix, rerun tests.

**Gate 6: Release**: offline/privacy/security review, CI green, versioned profiles, documented known limitations, approved sample outputs and rollback procedure.

For every stage: (a) list work items, (b) implement a small vertical slice, (c) run targeted tests, (d) review against known fixtures, (e) report files changed, verification commands and results, and unresolved issues, (f) request approval when crossing a gate. Do not move forward from a failing gate.

## 10. Claude Code Tool and Permission Policy
Use the installed Claude Code tools according to their availability and current documented behavior:
- **Plan Mode** for investigation and design before edits.
- **`AskUserQuestion`** for interview decisions, conflicts, and gate approvals when available. Never skip unanswered critical questions.
- **Read, Glob, Grep** for safe repo exploration; **Edit/Write** only after implementation approval.
- **Bash** for version checks, install, lint/typecheck/tests/build, controlled Git workflows; avoid unrelated or destructive commands.
- **Task/subagents** where supported for independent reference analysis, test review, and accessibility/security review. A subagent must not invent standards or override the accuracy engine.
- **Git** for short reversible commits, change review and traceability. Never rewrite shared history without express approval.
- **Playwright/browser testing** if available for visual validation and mobile interaction checks.
- **Web or approved reference files** for manufacturer/standard lookup, with source citations and revision tracking.

Project permission preferences: keep `.claude/settings.json` conservative. Do not check in tokens, API keys, personal job records, or permissions that enable bypass mode. Do not install unknown packages, download scripts for execution, delete unrelated files, or push/deploy without explicit operator approval. Ask about dependencies before installing them if project policy requires.

**Mode sequence:** `plan` -> user interviews -> written plan approval -> operator selects `auto` (where supported), `acceptEdits`, or manual -> build/test/verify. `bypassPermissions` is a separately authorized sandbox-only exception, never a default or automatic transition.

## 11. Definition of Done
A feature is done only when its rules are documented with sources, inputs and outputs are schema-validated, success and failure tests pass, the text/visual correspondence is checked, field examples are reviewed, accessibility is covered, and the operator has approved the stage. The UI must distinguish **Draft**, **Needs Verification**, **Verified**, and **Blocked** states without presenting an unverified count as a verified splice.

## 12. Instructions for Claude's First Response
At initial launch, **do not scaffold the app**. Confirm the session is in Plan Mode, summarize the mission and core accuracy risk in three to five sentences, then start **Interview Round A using `AskUserQuestion`** if supported. Ask focused questions, accept custom answers, and proceed through rounds. After interviews, present the proposed plan, repo structure, chosen stack, release gates, example cases requested, and explicit approval request. Wait for approval before creating or changing application source code.
