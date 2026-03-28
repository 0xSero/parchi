export type InjectedVideoFrameResult =
  | {
      success: true;
      time: number;
      timeFormatted: string;
      dataUrl: string;
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

export const injectedCaptureVideoFrame = (
  selector: string,
  targetTime: number,
  seekTimeoutMs: number,
): Promise<InjectedVideoFrameResult> => {
  return new Promise((res) => {
    const getErrorMessage = (error: unknown, fallback: string): string =>
      error instanceof Error ? error.message : fallback;
    const video = selector
      ? document.querySelector<HTMLVideoElement>(selector)
      : document.querySelector<HTMLVideoElement>('video');

    if (!video) {
      res({ success: false, error: 'Video element not found.' });
      return;
    }

    try {
      const testCanvas = document.createElement('canvas');
      testCanvas.width = 1;
      testCanvas.height = 1;
      const testCtx = testCanvas.getContext('2d');
      testCtx?.drawImage(video, 0, 0, 1, 1);
      testCtx?.getImageData(0, 0, 1, 1);
    } catch {
      res({
        success: false,
        error:
          'Video is cross-origin and cannot be captured. The video source must be same-origin or have CORS headers.',
      });
      return;
    }

    const captureFrame = () => {
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
      if (!ctx) {
        res({ success: false, error: 'Failed to create canvas.' });
        return;
      }

      try {
        ctx.drawImage(video, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        res({ success: true, time: targetTime, timeFormatted: formatTime(targetTime), dataUrl });
      } catch (e: unknown) {
        res({ success: false, error: getErrorMessage(e, 'Failed to capture frame.') });
      }
    };

    if (Math.abs(video.currentTime - targetTime) < 0.1) {
      captureFrame();
      return;
    }

    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      clearTimeout(timeout);
      setTimeout(captureFrame, 50);
    };

    const timeout = setTimeout(() => {
      video.removeEventListener('seeked', onSeeked);
      res({ success: false, error: 'Seek timed out.' });
    }, seekTimeoutMs);

    video.addEventListener('seeked', onSeeked);

    try {
      video.currentTime = targetTime;
    } catch (seekError: unknown) {
      video.removeEventListener('seeked', onSeeked);
      clearTimeout(timeout);
      res({ success: false, error: `Seek failed: ${getErrorMessage(seekError, 'Unknown error')}` });
    }
  });
};
