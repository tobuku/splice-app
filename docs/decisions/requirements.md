# Requirements Interview Summary

Date: 2026-11-01

## Round A: Users and Field Conditions
- **Users:** OSP copper splicers, fiber splicers, supervisors, trainees
- **Platform:** Phone PWA, offline-capable, mobile-first
- **Main outcome:** Lookup + full splice plan + as-built documentation
- **Real jobs for MVP:** Awaiting anonymized examples (UNRESOLVED -- Gate 5 dependency)

## Round B: Copper Conventions
- **Materials:** PIC, pulp, aerial, screened -- all supported
- **Legacy conventions:** Mixed/legacy -- UNRESOLVED, awaiting test cases
- **Operations MVP:** All -- straight, remap, branch, bridge tap, spare management
- **Orientation:** Reversed orientations regular; tip/ring polarity tracked

## Round C: Fiber Conventions
- **Types:** Loose tube, ribbon, central tube, distribution, legacy -- all
- **Counts:** Up to 864F+
- **Color code:** TIA-598 12-color as baseline
- **Operations MVP:** All -- straight-through, mid-span, branch, cross-connect
- **Tray/port mapping:** NOT in MVP

## Round D: Outputs and Controls
- **Output formats:** On-screen schedule, SVG diagram, PDF, CSV/JSON -- all, selectable
- **Storage:** Local-only (IndexedDB)
- **Audit:** Full log from day one; approval chain UI deferred (log-only enforcement)
- **Test cases:** User provides after MVP scaffold

## UNRESOLVED Items
1. Legacy copper count conventions
2. Legacy fiber cable types
3. Golden test cases (3 copper, 3 fiber, 3 cross-profile minimum)
