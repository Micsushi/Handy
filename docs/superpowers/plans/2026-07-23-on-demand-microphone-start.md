# On-Demand Microphone Start Implementation Plan

> REQUIRED SUB-SKILL: Use superpowers:executing-plans.

**Goal:** Reduce lost opening speech while preserving on-demand microphone
privacy through capture-first startup, a five-minute warm window, and a
sample-backed ready indicator.

**Architecture:** Keep device lifecycle ownership in
`AudioRecordingManager`, but increase its bounded lazy-close timeout and use one
resettable close worker. Route the shortcut start through a small
capture-before-UI helper so the ordering is unit-testable. Emit one readiness
event from the first captured chunk, suppress idle level events, and keep
live-preview reveal gated until readiness.

**Tech Stack:** Rust, Tauri 2, React 18, TypeScript, Bun test.

## Task 1: Five-minute warm-close timeout

**Files:**

- Modify: `src-tauri/src/managers/audio.rs`

- [ ] Add this test inside `managers::audio::tests`:

  ```rust
  #[test]
  fn lazy_stream_close_keeps_the_microphone_warm_for_five_minutes() {
      assert_eq!(STREAM_IDLE_TIMEOUT, Duration::from_secs(5 * 60));
  }
  ```

- [ ] Run:

  ```powershell
  $env:CARGO_TARGET_DIR='C:\Users\sushi\Documents\Github\Handy\src-tauri\target'
  cargo test --manifest-path src-tauri/Cargo.toml lazy_stream_close_keeps_the_microphone_warm_for_five_minutes --lib
  ```

  Expected: fail because the timeout is currently 30 seconds.

- [ ] Change:

  ```rust
  const STREAM_IDLE_TIMEOUT: Duration = Duration::from_secs(5 * 60);
  ```

- [ ] Re-run the focused test. Expected: pass.

## Task 2: Capture before tray and overlay work

**Files:**

- Modify: `src-tauri/src/actions.rs`

- [ ] Add a closure-based unit test that records `"capture"` and `"ui"` calls
      and asserts that the extracted helper invokes them in that order.
- [ ] Run:

  ```powershell
  $env:CARGO_TARGET_DIR='C:\Users\sushi\Documents\Github\Handy\src-tauri\target'
  cargo test --manifest-path src-tauri/Cargo.toml capture_starts_before_recording_ui --lib
  ```

  Expected: fail because the helper does not exist.

- [ ] Add:

  ```rust
  fn start_capture_before_ui<T>(
      start_capture: impl FnOnce() -> Result<T, String>,
      show_ui: impl FnOnce(),
  ) -> Result<T, String> {
      let started = start_capture()?;
      show_ui();
      Ok(started)
  }
  ```

- [ ] Refactor `TranscribeAction::start` so model/VAD planning occurs first,
      `try_start_recording` is passed as `start_capture`, and tray/overlay changes
      are passed as `show_ui`. Keep existing feedback, mute, registration, and error
      handling behavior.
- [ ] Re-run the focused test. Expected: pass.

## Task 3: Sample-backed overlay readiness

**Files:**

- Modify: `src-tauri/src/audio_toolkit/audio/recorder.rs`
- Modify: `src-tauri/src/managers/audio.rs`
- Modify: `src/overlay/livePreviewPresentation.ts`
- Modify: `src/overlay/livePreviewPresentation.test.ts`
- Modify: `src/overlay/RecordingOverlay.tsx`

- [ ] Add tests for:

  ```ts
  recordingPresentation(false, false);
  // => { starting: true, listening: false }

  recordingPresentation(true, false);
  // => { starting: false, listening: true }

  recordingPresentation(false, true);
  // => { starting: false, listening: false }
  ```

- [ ] Run:

  ```powershell
  bun test src/overlay/livePreviewPresentation.test.ts
  ```

  Expected: fail because `recordingPresentation` is not exported.

- [ ] Implement the pure presentation helper.
- [ ] Add `captureReady` state to `RecordingOverlay`.
- [ ] Reset readiness on every `show-overlay` recording/streaming event and set
      it after the first captured chunk's `capture-ready` event.
- [ ] Suppress `mic-level` callbacks while the stream is warm but no recording
      is active.
- [ ] Trigger optional start feedback from capture readiness instead of a fixed
      100 ms delay.
- [ ] Guard delayed mute application with a recording-session generation so
      stop/cancel invalidation wins any race with feedback playback.
- [ ] Before readiness, render the existing spinner row with
      `modelSelector.loadingGeneric`; after readiness, render the waveform row.
- [ ] Start `LIVE_PREVIEW_REVEAL_MS` only after capture is ready.
- [ ] Re-run the focused test. Expected: pass.

## Task 4: Resettable warm-close worker

**Files:**

- Modify: `src-tauri/src/managers/audio.rs`

- [ ] Add behavioral tests proving a second schedule resets the timer and a
      cancel prevents closure.
- [ ] Replace per-recording sleeping threads with one manager-owned worker and a
      `Schedule`/`Cancel` command channel.
- [ ] Keep the recording-state lock across the idle check and stream close.
- [ ] Run the focused worker tests. Expected: pass.

## Task 5: Profile setting and full verification

**Files:**

- Modify local profile:
  `%APPDATA%\com.pais.handy\settings_store.json`

- [ ] Set `always_on_microphone` to `false`.
- [ ] Set `lazy_stream_close` to `true`.
- [ ] Run:

  ```powershell
  bun test src/overlay/livePreviewPresentation.test.ts
  $env:CARGO_TARGET_DIR='C:\Users\sushi\Documents\Github\Handy\src-tauri\target'
  cargo test --manifest-path src-tauri/Cargo.toml --lib
  bun run lint
  bun run format:check
  bun run build
  git diff --check
  ```

- [ ] Review `git diff`, excluding unrelated/generated files.
- [ ] Restart Handy from the updated checkout and make two recordings less than
      five minutes apart.
- [ ] Verify logs show capture initialization before tray/overlay timing and the
      second recording reuses the already-active stream.
- [ ] Commit the intended repository files with the existing human identity:

  ```powershell
  git commit -m "Reduce microphone startup delay"
  ```
