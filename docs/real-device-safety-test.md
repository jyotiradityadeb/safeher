# Real Device Safety Flow Test

## Goal
Validate real user flow:
`gesture -> cancel window -> send now -> SMS app -> map link -> status update`.

## Preconditions
- Android device with SIM and SMS app.
- Logged in user with at least one trusted contact.
- Background location tracking enabled in Gesture Setup.
- Network enabled.

## Test Steps
1. Open SafeHer and go to Home.
2. Draw emergency gesture.
3. Confirm full-screen cancel window appears with countdown and vibration.
4. Tap `Send Now`.
5. Verify SMS draft opens and includes map link.
6. Tap map link and verify Google Maps opens at correct coordinates.
7. Return to SafeHer and open `Post-Alert Actions`.
8. Tap `Share update` and verify trusted circle room updates.
9. Open `Status` tab and verify alert + room + smart check-in info.
10. Minimize app and wait past auto-escalation timeout; reopen and verify escalation state.

## Friction Notes (fill after run)
- Permission prompts sequence:
- SMS app handoff latency:
- Map link open latency:
- Time to detect gesture:
- Overlay readability under stress:
- Smart check-in clarity:
- Any missed escalations while minimized:

## Known Risks To Watch
- If battery optimization is aggressive, background location callbacks may be delayed.
- If SMS app is unavailable or blocked, alert is still created but draft opening can fail.
