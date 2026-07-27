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

export const streamWorkPresentation = (kind: string) => {
  switch (kind) {
    case "loading_model":
      return {
        labelKey: "overlay.loadingSpeechModel",
        warning: false,
      };
    case "system_busy":
      return {
        labelKey: "overlay.systemBusy",
        warning: true,
      };
    case "polishing":
      return {
        labelKey: "overlay.processing",
        warning: false,
      };
    default:
      return {
        labelKey: "overlay.transcribing",
        warning: false,
      };
  }
};
