export type InjectedVideoFrame = {
  time: number;
  timeFormatted: string;
  dataUrl: string;
};

export type InjectedVideoFramesResult =
  | {
      success: true;
      frames: InjectedVideoFrame[];
    }
  | {
      success: false;
      error: string;
    };

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Captures every frame in one injection instead of one chrome.scripting.executeScript round
// trip per frame — a 60s/2s-interval watch previously spent multiple extra seconds purely on
// injection/dispatch overhead across up to 30 separate calls.
export const injectedCaptureVideoFrames = async (
  selector: string,
  startTime: number,
  endTime: number,
  intervalSeconds: number,
  maxFrames: number,
  seekTimeoutMs: number,
  interFrameDelayMs: number,
): Promise<InjectedVideoFramesResult> => {
  const video = selector
    ? document.querySelector<HTMLVideoElement>(selector)
    : document.querySelector<HTMLVideoElement>('video');

  if (!video) {
    return { success: false, error: 'Video element not found.' };
  }

  try {
    const testCanvas = document.createElement('canvas');
    testCanvas.width = 1;
    testCanvas.height = 1;
    const testCtx = testCanvas.getContext('2d');
    testCtx?.drawImage(video, 0, 0, 1, 1);
    testCtx?.getImageData(0, 0, 1, 1);
  } catch {
    return {
      success: false,
      error: 'Video is cross-origin and cannot be captured. The video source must be same-origin or have CORS headers.',
    };
  }

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const seekTo = (targetTime: number): Promise<boolean> => {
    return new Promise((resolve) => {
      if (Math.abs(video.currentTime - targetTime) < 0.1) {
        resolve(true);
        return;
      }

      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked);
        clearTimeout(timeout);
        setTimeout(() => resolve(true), 50);
      };

      const timeout = setTimeout(() => {
        video.removeEventListener('seeked', onSeeked);
        resolve(false);
      }, seekTimeoutMs);

      video.addEventListener('seeked', onSeeked);

      try {
        video.currentTime = targetTime;
      } catch {
        video.removeEventListener('seeked', onSeeked);
        clearTimeout(timeout);
        resolve(false);
      }
    });
  };

  const captureFrame = (targetTime: number): InjectedVideoFrame | null => {
    const canvas = document.createElement('canvas');
    const maxDim = 512;
    let width = video.videoWidth || 640;
    let height = video.videoHeight || 480;

    if (width > maxDim || height > maxDim) {
      const scale = maxDim / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    try {
      ctx.drawImage(video, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
      return { time: targetTime, timeFormatted: formatTime(targetTime), dataUrl };
    } catch {
      return null;
    }
  };

  const frames: InjectedVideoFrame[] = [];
  for (
    let currentTime = startTime;
    currentTime <= endTime && frames.length < maxFrames;
    currentTime += intervalSeconds
  ) {
    const seeked = await seekTo(currentTime);
    if (seeked) {
      const frame = captureFrame(currentTime);
      if (frame) frames.push(frame);
    }
    await sleep(interFrameDelayMs);
  }

  if (frames.length === 0) {
    return { success: false, error: 'Failed to capture any frames from the video.' };
  }

  return { success: true, frames };
};
