import { describeImageWithModel } from '../../ai/sdk-client.js';
import { captureReportImage, getReportImageSummary } from '../report-images.js';
import type { ServiceContext } from '../service-context.js';
import type { SessionState } from '../service-types.js';
import {
  type ToolExecutionArgs,
  type ToolExecutionOptions,
  formatToolExecutorError,
  isObjectRecord,
} from './tool-executor-shared.js';

type VideoFrame = {
  time: number;
  timeFormatted: string;
  dataUrl: string;
};

type VisionModelSettings = {
  provider: string;
  apiKey: string;
  model: string;
  customEndpoint?: string;
};

const getVisionSettings = (visionProfile: ToolExecutionOptions['visionProfile']): VisionModelSettings | null => {
  if (!visionProfile || typeof visionProfile.apiKey !== 'string' || !visionProfile.apiKey) {
    return null;
  }
  return {
    provider: String(visionProfile.provider || ''),
    apiKey: visionProfile.apiKey,
    model: String(visionProfile.model || ''),
    customEndpoint: typeof visionProfile.customEndpoint === 'string' ? visionProfile.customEndpoint : undefined,
  };
};

const isVideoFrame = (value: unknown): value is VideoFrame =>
  isObjectRecord(value) &&
  typeof value.time === 'number' &&
  typeof value.timeFormatted === 'string' &&
  typeof value.dataUrl === 'string';

export async function handleScreenshotResult(
  ctx: ServiceContext,
  sessionState: SessionState,
  result: unknown,
  args: ToolExecutionArgs,
  options: ToolExecutionOptions,
  callId: string,
) {
  if (!isObjectRecord(result) || result.success !== true || typeof result.dataUrl !== 'string') {
    return result;
  }

  const visionSettings = getVisionSettings(options.visionProfile);
  if (options.settings.visionBridge && visionSettings) {
    try {
      const description = await describeImageWithModel({
        settings: visionSettings,
        dataUrl: result.dataUrl,
        prompt: 'Provide a concise description of this screenshot for a non-vision model.',
      });
      result.visionDescription = description;
      result.message = 'Screenshot captured and described by vision model.';
    } catch (error) {
      result.visionError = formatToolExecutorError(error);
    }
  }

  const reportImage = captureReportImage(sessionState, result, args, callId);
  if (reportImage) {
    const imagePayload = {
      id: reportImage.id,
      dataUrl: reportImage.dataUrl,
      capturedAt: reportImage.capturedAt,
      toolCallId: reportImage.toolCallId,
      tabId: reportImage.tabId,
      url: reportImage.url,
      title: reportImage.title,
      visionDescription: reportImage.visionDescription,
      selected: sessionState.selectedReportImageIds.has(reportImage.id),
    };
    ctx.sendRuntime(options.runMeta, {
      type: 'report_image_captured',
      image: imagePayload,
      images: getReportImageSummary(sessionState),
      selectedImageIds: Array.from(sessionState.selectedReportImageIds),
    });
    result.reportImageId = reportImage.id;
  }

  if (!options.settings.sendScreenshotsAsImages) {
    delete result.dataUrl;
  }

  return result;
}

export async function handleWatchVideoResult(result: unknown, options: ToolExecutionOptions) {
  if (!isObjectRecord(result) || result.success !== true || !Array.isArray(result.frames)) {
    return result;
  }

  const frames = result.frames.filter(isVideoFrame);
  if (!frames.length) {
    return result;
  }

  const visionSettings = getVisionSettings(options.visionProfile);
  if (!(options.settings.visionBridge && visionSettings)) {
    result.message = `Captured ${frames.length} video frames. Configure a vision profile to enable automatic analysis.`;
    return result;
  }

  try {
    const question =
      typeof result.question === 'string' && result.question.trim()
        ? result.question
        : 'What is happening in this video? Describe the content, actions, and any important details.';

    const frameDescriptions: string[] = [];
    const maxFrames = Math.min(frames.length, 8);
    const step = frames.length > maxFrames ? Math.floor(frames.length / maxFrames) : 1;

    for (let index = 0; index < frames.length && frameDescriptions.length < maxFrames; index += step) {
      const frame = frames[index];
      try {
        const description = await describeImageWithModel({
          settings: visionSettings,
          dataUrl: frame.dataUrl,
          prompt: `At timestamp ${frame.timeFormatted}: Describe what you see in this video frame.`,
          maxTokens: 256,
        });
        frameDescriptions.push(`[${frame.timeFormatted}] ${description}`);
      } catch (error) {
        frameDescriptions.push(`[${frame.timeFormatted}] (Failed to analyze frame: ${formatToolExecutorError(error)})`);
      }
    }

    const fullDescription = await describeImageWithModel({
      settings: visionSettings,
      dataUrl: frames[0].dataUrl,
      prompt: `Based on these frame-by-frame descriptions from a video:\n\n${frameDescriptions.join('\n\n')}\n\n${question}\n\nProvide a coherent summary of what happens in the video.`,
      maxTokens: 1024,
    });

    result.analysis = fullDescription;
    result.frameDescriptions = frameDescriptions;
    result.analyzedFrameCount = frameDescriptions.length;
    result.message = `Analyzed ${frameDescriptions.length} frames from video.`;
    delete result.frames;
  } catch (error) {
    const message = formatToolExecutorError(error);
    result.visionError = message;
    result.message = `Video frames captured but analysis failed: ${message}`;
  }

  return result;
}
