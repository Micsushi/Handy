import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  LIVE_PREVIEW_REVEAL_MS,
  livePreviewPresentation,
  recordingPresentation,
} from "./livePreviewPresentation";

describe("live preview presentation", () => {
  test("reveals an empty live panel within one second", () => {
    assert.ok(LIVE_PREVIEW_REVEAL_MS >= 500);
    assert.ok(LIVE_PREVIEW_REVEAL_MS <= 1000);
    assert.deepEqual(livePreviewPresentation(false, true, false), {
      open: true,
      collapsed: false,
    });
  });

  test("opens immediately when provisional text arrives", () => {
    assert.deepEqual(livePreviewPresentation(true, false, false), {
      open: true,
      collapsed: false,
    });
  });

  test("keeps the no-text working state compact before reveal", () => {
    assert.deepEqual(livePreviewPresentation(false, false, true), {
      open: false,
      collapsed: true,
    });
  });

  test("shows loading until real microphone samples arrive", () => {
    assert.deepEqual(recordingPresentation(false, false), {
      starting: true,
      listening: false,
    });
    assert.deepEqual(recordingPresentation(true, false), {
      starting: false,
      listening: true,
    });
  });

  test("lets the finalizing state override capture readiness", () => {
    assert.deepEqual(recordingPresentation(false, true), {
      starting: false,
      listening: false,
    });
    assert.deepEqual(recordingPresentation(true, true), {
      starting: false,
      listening: false,
    });
  });
});
