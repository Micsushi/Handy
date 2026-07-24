export const LIVE_PREVIEW_REVEAL_MS = 750;

export const livePreviewPresentation = (
  hasText: boolean,
  revealReady: boolean,
  working: boolean,
) => {
  const open = hasText || revealReady;
  return {
    open,
    collapsed: working && !open,
  };
};

export const recordingPresentation = (
  captureReady: boolean,
  working: boolean,
) => ({
  starting: !captureReady && !working,
  listening: captureReady && !working,
});
