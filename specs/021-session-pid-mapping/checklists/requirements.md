# Requirements Checklist: 021-session-pid-mapping

## Spec Quality

- [x] All user stories have P1/P2/P3 priority assigned
- [x] All user stories have independent test criteria
- [x] All user stories have acceptance scenarios in Given/When/Then format
- [x] All functional requirements are measurable and testable
- [x] All success criteria are measurable with specific thresholds
- [x] Edge cases are documented
- [x] Assumptions are stated explicitly
- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Key entities are identified

## FR Coverage

- [x] FR-001: Claude Code PID resolution via hook cwd + process list
- [x] FR-002: session_pids audit table
- [x] FR-003: Multiple concurrent sessions handled independently
- [x] FR-004: JSONL freshness fallback when PID resolution fails
- [x] FR-005: Session ended within 5s when PID exits
- [x] FR-006: Copilot CLI lock file mechanism maintained
- [x] FR-007: API exposes PID and source
- [x] FR-008: Retry PID resolution on poll cycles for null-PID sessions
- [x] FR-009: Windows process tree walking
- [x] FR-010: No duplicate session records from repeated scans

## SC Coverage

- [x] SC-001: Two simultaneous sessions get PIDs within 10s
- [x] SC-002: Session ends within 10s of process exit
- [x] SC-003: session_pids table has correct audit rows
- [x] SC-004: Windows shows real PID, not wrapper
- [x] SC-005: Copilot CLI end detection within 10s
- [x] SC-006: Null-PID sessions retried each cycle
