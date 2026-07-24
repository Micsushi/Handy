# On-Demand Microphone Start Design

## Goal

Reduce missing or incorrect opening words without keeping Handy's microphone
open for the entire lifetime of the application.

## Approved approach

Keep `always_on_microphone` disabled and combine three bounded changes:

1. Start on-demand capture before tray and overlay updates.
2. Keep the microphone stream warm for five minutes after a recording.
3. Show a starting state until Handy receives real microphone samples.

## Recording flow

When the transcription shortcut is pressed:

1. Read settings and determine the model/VAD capture policy.
2. Request `AudioRecordingManager::try_start_recording`.
3. If startup succeeds, update the tray and show the recording overlay.
4. The overlay initially displays a spinner and a localized loading label.
5. The first raw chunk processed after the recorder's start command emits a
   one-shot `capture-ready` event. That event switches the overlay to its normal
   dot, waveform, timer, and live-preview presentation and triggers optional
   audio feedback. Any delayed mute is guarded by the recording session, so it
   cannot re-mute the system after that recording stops or is cancelled.
6. If startup fails, do not show a recording-ready state; restore the idle tray
   and surface the existing recording error.

Model loading may still be kicked off before capture because it is asynchronous
and does not block microphone initialization.

## Warm-close behavior

Enable the existing `lazy_stream_close` setting for the active profile.
After recording stops or is cancelled, the input stream stays open for five
minutes and then closes automatically. A new recording during this grace period
reuses the stream and cancels the pending close.

Audio received during the grace period is not added to a recording, sent to the
streaming transcription router, or transcribed. This remains different from the
application-wide always-on mode because the device closes after the bounded
idle timeout.

One resettable worker owns the grace-period timer. Repeated recordings reset
that timer instead of creating one five-minute sleeping thread per recording.
Idle microphone levels are not emitted to the WebView during the grace period.

## Overlay behavior

Both minimal and live overlays use the same capture readiness state:

- Before the first captured audio chunk: spinner and loading label.
- After the event: the existing recording waveform.
- For live transcription, the empty provisional-text panel reveal timer begins
  only after capture is ready.
- Finalizing/transcribing states continue to override the recording-ready UI.

The readiness state resets for every recording session so a warm microphone
cannot leak the previous session's UI state.

## Testing and verification

- Add frontend unit tests for the starting-to-ready presentation state.
- Add a backend ordering test around the extracted start-sequence helper so
  tray/overlay work cannot move back ahead of capture.
- Add a backend timeout test for the five-minute grace period.
- Add backend tests proving idle streams do not emit levels, captured readiness
  fires once, invalidated sessions reject late mute actions, and the close
  worker resets or cancels one timer.
- Run focused frontend and Rust tests, formatting, linting, and production
  builds.
- Restart the local Handy build and confirm from logs that on-demand microphone
  initialization begins before tray/overlay work and that warm starts reuse the
  stream.

## Non-goals

- No application-wide always-on microphone.
- No pre-hotkey audio buffer.
- No changes to VAD onset or trailing-recording buffering.
- No automatic default change for other users.
