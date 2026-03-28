// Event types captured by content script
export type RecordingEventType = 'click' | 'scroll' | 'input' | 'navigation' | 'dom_mutation';

export type RecordingEvent = {
  type: RecordingEventType;
  timestamp: number;
  url: string;
  // click
  selector?: string;
  tagName?: string;
  textContent?: string;
  position?: { x: number; y: number };
  // scroll
  scrollY?: number;
  direction?: 'up' | 'down';
  // input
  inputType?: string;
  placeholder?: string;
  // navigation
  fromUrl?: string;
  toUrl?: string;
  trigger?: string;
  // dom_mutation
  summary?: string;
  addedCount?: number;
  removedCount?: number;
  attributeChanges?: number;
};

export type RecordingScreenshot = {
  id: string;
  timestamp: number;
  dataUrl: string;
  url: string;
  index: number;
};

export type RecordingStatus = 'idle' | 'recording' | 'selecting' | 'ready';

export type RecordingState = {
  status: RecordingStatus;
  tabId: number;
  startedAt: number;
  elapsedMs: number;
  screenshotCount: number;
  eventCount: number;
};

export type RecordedContext = {
  id: string;
  createdAt: number;
  duration: number;
  selectedImages: Array<{ dataUrl: string; timestamp: number; url: string; index: number }>;
  events: RecordingEvent[];
  urlTimeline: Array<{ url: string; timestamp: number }>;
  summary: string;
};

// Command messages (sidepanel -> background)
export type RecordingCommand =
  | { type: 'recording_start'; tabId?: number }
  | { type: 'recording_stop' }
  | { type: 'recording_select_images'; selectedIds: string[] }
  | { type: 'recording_discard' };

// Update messages (background -> sidepanel)
export type RecordingUpdate =
  | { type: 'recording_tick'; elapsedMs: number; screenshotCount: number; eventCount: number }
  | { type: 'recording_complete'; screenshots: RecordingScreenshot[]; events: RecordingEvent[] }
  | { type: 'recording_context_ready'; context: RecordedContext }
  | { type: 'recording_error'; message: string };

export type RecordingMessageType = RecordingCommand['type'] | RecordingUpdate['type'];

// === Composable Skill Types ===

export type AtomicSkill = {
  tool: string;
  args: Record<string, unknown>;
  precondition?: { urlPattern?: string; requireSelector?: string };
  postcondition?: { expectUrlChange?: boolean; expectSelector?: string };
};

export type ComposedSkill = {
  id: string;
  name: string;
  description: string;
  sitePattern: string;
  steps: AtomicSkill[];
  prompt?: string;
  positiveExamples: Array<{ tool: string; args: Record<string, unknown>; result: string }>;
  negativeExamples: Array<{ tool: string; args: Record<string, unknown>; error: string; count: number }>;
  createdAt: number;
  sourceSessionId?: string;
  successCount: number;
  failureCount: number;
};
