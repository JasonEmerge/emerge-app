# EMERGE — v18.6 Deploy (Sidereal Inner Experience + Restored Reveal Transition)

Drop this whole folder (or the zip) on Netlify. Three HTML files, one experience, runs from index.html. v18.2 adds a hard system guard to both reveal files: each reads the saved system value and halts with a visible error and a return link if it receives the other system's record, instead of rendering a mislabeled chart. Reveal stamps read SIDEREAL v18.6 and TROPICAL v18.3 for cache verification.

- index.html — complete Scene 1. New in v18: after the birth time is confirmed, the Earth recedes, lowers, shrinks slightly and fades completely away. The two-perspective choice screen only appears once the Earth is fully invisible, over the star field alone, with a subtle contrast overlay behind the copy.
- sidereal-reveal.html — chart animation, calculations, routing and reference cards unchanged. New in v18.5: the summary is now YOUR INNER EXPERIENCE with four sections, YOUR RISING SIGN & GUIDING INFLUENCE, YOUR INNER WORLD, YOUR FAMILY DYNAMIC, YOUR DHARMA & DIRECTION, each with a gold circle icon matching the Tropical treatment. Four separated interpretation functions read the verified Sidereal profile; SIDEREAL_SUMMARY_TRACE prints hidden sources and themes to the console; the old mechanical bridge templates are deleted. New in v18.6: tapping REVEAL MY CHART runs the full cinematic transition again (chart pulls backward into 3D, gold orbital rings form beneath, the vertical beam rises, the rounded card lifts through the light) before dissolving into the combined result page. Same original timeline, classes, particles, and parallax; reduced-motion users still get the direct fade. Stamp reads SIDEREAL v18.6.
- tropical-reveal.html — same structure, Tropical labels only: WESTERN TROPICAL CHART / TROPICAL ZODIAC, Ascendant with degree, Your Planets (twelve bodies including outer planets and nodes). No Sidereal wording anywhere in the Tropical result.

Everything on the result page is generated from the same validated chart data used by the reveal. Nothing is hardcoded; the QA fallback profile only appears when no birth data exists in storage, exactly as before. The visible summary remains free of astrology terminology; the chart reference above it carries the technical placements. [EMERGE TRACE] still prints to the console.

Reveal guards remain REQUIRE_BIRTH_DATA = false for testing. Flip to true per file before launch.
Safari caches hard: redeploy fresh or rename the site if you see a stale build.

---

## SOUND v1 — Final Sound System V4 installed
- New: `emerge-sound.js` (centralized EMERGE_SOUND engine) + `audio/` (the 18 approved final WAVs). Deploy the whole folder — the audio directory must ship alongside the three HTML files.
- Scene 1 wiring: Void starts on the first tap (iOS gesture unlock); Tap to Emerge pulse; Blue Dot; Earth Growth driven by real formation progress with the Arrival impact at camera arrival; drag + gyro feed Phone Motion Bend; pinch feeds Vacuum Fold; the birthplace flight drives Silent Orbit from actual velocity; Location Found on arrival; muted digit pulses on date/time entry only; Birth Data Complete on AM/PM; calculation layer + irregular micro-pulses follow the genesis status line; calculation:complete fires before navigation.
- Reveal wiring (both files): sound follows the drawing timeline `t` — near-silence + breath for "the sky has always been here", magnetic locks per ring/division, one grouped placement for headers, the one-second sweep, unified planet tokens panned from each graha's real screen x, the clean reveal impact, then the Reading Hum. No fixed timeouts anywhere.
- Mixing: final WAV levels preserved (no normalization); master limiter only guards stacking; the Void ducks beneath important cues. Haptics accompany only the major moments and fail gracefully.
- iOS note: browsers keep audio suspended until the first touch on each page. Scene 1 unlocks on the opening tap; on the reveal pages sound joins at the user's first touch. Events before that are dropped silently by design.
