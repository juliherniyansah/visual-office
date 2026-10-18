# problems

## [orchestrator] BLOCKED at todo 9 (checkpoint 2a)
- Needs user: approve hq_v01 (or revisions) + confirm image model (nano-banana-2 6cr/img, max 24cr) before todo 7.
- Boulder continuation prompt is NOT a human reply (plan "Checkpoint integrity"). No USER_APPROVED_2A token written.
- Todos 7, 10, 11 depend on 9 per plan; 12+ depend on those. Nothing executable until reply.

## [orchestrator] RESUME NOTE
- Todos 7, 9, 10, 11 are marked `[~]` (blocked on user). After a HUMAN reply approving 2a: quote it verbatim in 25-checkpoint-2a.md with USER_APPROVED_2A + IMAGE_MODEL_CONFIRMED, flip 9 to [x], flip 7/10/11 back to [ ], then run 7 || 11 in parallel (10 after 7).
- On a revision request: reopen todo 8 (flip to [ ]), apply change to hq_*.py, rebuild hq_v01.blend (still unfrozen until approval), re-render, re-present.

## [orchestrator] FALSE "BOULDER COMPLETE" nudge
- Hook counts [~] as done -> marked work completed + fired nudge. Real state: 7/23 [x], 16 [~] blocked on user (checkpoint 2a). boulder.json status reset to paused.
- On resume: flip the [~] rows back to [ ] before executing, and set status back to active.
