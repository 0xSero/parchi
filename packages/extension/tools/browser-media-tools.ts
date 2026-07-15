import { type BrowserToolArgs, type BrowserToolsDelegate, missingSessionTabError } from './browser-tool-shared.js';
import { injectedCaptureVideoFrames } from './injected/video-frame.js';
import { injectedVideoCheck } from './injected/video.js';

const JPEG_QUALITY_MAP: Record<string, number> = {
  high: 80,
  medium: 60,
  low: 40,
};

export async function screenshotTool(ctx: BrowserToolsDelegate, args: BrowserToolArgs) {
  const tabId = await ctx.resolveTabId(args);
  if (!tabId) return missingSessionTabError();
  const tab = await chrome.tabs.get(tabId);
  const quality = JPEG_QUALITY_MAP[ctx.screenshotQuality || ''] ?? 70;
  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
    format: 'jpeg',
    quality,
  });
  await ctx.sendOverlay(tabId, { label: 'Screenshot captured', durationMs: 1000 }, 1);
  return { success: true, dataUrl };
}

export async function getVideoInfoTool(ctx: BrowserToolsDelegate, args: BrowserToolArgs) {
  const tabId = await ctx.resolveTabId(args);
  if (!tabId) return missingSessionTabError();

  const selector = args.selector ? String(args.selector) : '';
  await ctx.sendOverlay(tabId, { label: 'Get video info', durationMs: 800 }, 1);

  const result = await ctx.runInTab(
    tabId,
    (sel: string) => {
      const videos = sel
        ? Array.from(document.querySelectorAll<HTMLVideoElement>(sel))
        : Array.from(document.querySelectorAll<HTMLVideoElement>('video'));

      if (videos.length === 0) {
        return {
          success: false,
          error: 'No video elements found on the page.',
          hint: 'Make sure the page has a <video> element, or provide a specific selector.',
        };
      }

      const info = videos.map((video, index) => ({
        index,
        src: video.currentSrc || video.src || null,
        currentSrc: video.currentSrc || null,
        duration: video.duration || 0,
        currentTime: video.currentTime || 0,
        paused: video.paused,
        ended: video.ended,
        muted: video.muted,
        volume: video.volume,
        playbackRate: video.playbackRate || 1,
        readyState: video.readyState,
        networkState: video.networkState,
        videoWidth: video.videoWidth || 0,
        videoHeight: video.videoHeight || 0,
        aspectRatio: video.videoWidth && video.videoHeight ? `${video.videoWidth}x${video.videoHeight}` : null,
        id: video.id || null,
        className: video.className || null,
      }));

      return {
        success: true,
        videoCount: videos.length,
        videos: info,
      };
    },
    [selector] as const,
  );

  return result || { success: false, error: 'Script execution failed.' };
}

export async function watchVideoTool(ctx: BrowserToolsDelegate, args: BrowserToolArgs) {
  const tabId = await ctx.resolveTabId(args);
  if (!tabId) return missingSessionTabError();

  const selector = args.selector ? String(args.selector) : '';
  const durationSeconds = Math.min(Math.max(1, Number(args.durationSeconds) || 10), 60);
  const frameIntervalSeconds = Math.min(Math.max(0.5, Number(args.frameIntervalSeconds) || 2), 10);
  const question = args.question ? String(args.question) : null;

  const maxFrames = 30;
  const effectiveInterval = Math.max(frameIntervalSeconds, durationSeconds / maxFrames);

  await ctx.sendOverlay(
    tabId,
    {
      label: 'Watching video',
      note: `${durationSeconds}s at ${effectiveInterval.toFixed(1)}s intervals`,
      durationMs: (durationSeconds + 3) * 1000,
    },
    1,
  );

  const videoCheck = await ctx.runInTab(tabId, injectedVideoCheck, [selector] as const);

  if (!videoCheck?.success) {
    return videoCheck || { success: false, error: 'Failed to check video.' };
  }

  const startTime = Math.max(0, videoCheck.video.currentTime);
  const endTime = Math.min(videoCheck.video.duration || startTime + durationSeconds, startTime + durationSeconds);

  const captureResult = await ctx.runInTab(tabId, injectedCaptureVideoFrames, [
    selector,
    startTime,
    endTime,
    effectiveInterval,
    maxFrames,
    2000,
    150,
  ] as const);

  if (!captureResult?.success) {
    return {
      success: false,
      error: captureResult?.error || 'Failed to capture any frames from the video.',
      hint: 'The video may be protected (DRM), cross-origin, or not loaded properly.',
    };
  }

  const frames = captureResult.frames;

  return {
    success: true,
    video: videoCheck.video,
    frameCount: frames.length,
    frameIntervalSeconds: effectiveInterval,
    frames,
    question,
    note: `Captured ${frames.length} frames from video. These frames can be analyzed with a vision-capable model.`,
  };
}
