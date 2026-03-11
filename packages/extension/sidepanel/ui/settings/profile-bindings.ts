export type BooleanBinding = {
  elementKey: string;
  configKey: string;
  defaultTrue: boolean;
};

export type NumberBinding = {
  elementKey: string;
  configKey: string;
  fallback: number;
  parseMode: 'int' | 'float';
};

export const PROFILE_EDITOR_BOOLEAN_BINDINGS: BooleanBinding[] = [
  { elementKey: 'profileEditorEnableScreenshots', configKey: 'enableScreenshots', defaultTrue: false },
  { elementKey: 'profileEditorSendScreenshots', configKey: 'sendScreenshotsAsImages', defaultTrue: false },
  { elementKey: 'profileEditorShowThinking', configKey: 'showThinking', defaultTrue: true },
  { elementKey: 'profileEditorStreamResponses', configKey: 'streamResponses', defaultTrue: true },
  { elementKey: 'profileEditorAutoScroll', configKey: 'autoScroll', defaultTrue: true },
  { elementKey: 'profileEditorConfirmActions', configKey: 'confirmActions', defaultTrue: true },
  { elementKey: 'profileEditorSaveHistory', configKey: 'saveHistory', defaultTrue: true },
];

export const PROFILE_EDITOR_NUMBER_BINDINGS: NumberBinding[] = [
  { elementKey: 'profileEditorTemperature', configKey: 'temperature', fallback: 0.7, parseMode: 'float' },
  { elementKey: 'profileEditorMaxTokens', configKey: 'maxTokens', fallback: 2048, parseMode: 'int' },
  { elementKey: 'profileEditorContextLimit', configKey: 'contextLimit', fallback: 200000, parseMode: 'int' },
  { elementKey: 'profileEditorTimeout', configKey: 'timeout', fallback: 30000, parseMode: 'int' },
];

export const SETTINGS_FORM_BOOLEAN_BINDINGS: BooleanBinding[] = [
  { elementKey: 'enableScreenshots', configKey: 'enableScreenshots', defaultTrue: false },
  { elementKey: 'sendScreenshotsAsImages', configKey: 'sendScreenshotsAsImages', defaultTrue: false },
  { elementKey: 'streamResponses', configKey: 'streamResponses', defaultTrue: true },
  { elementKey: 'showThinking', configKey: 'showThinking', defaultTrue: true },
  { elementKey: 'autoScroll', configKey: 'autoScroll', defaultTrue: true },
  { elementKey: 'confirmActions', configKey: 'confirmActions', defaultTrue: true },
  { elementKey: 'saveHistory', configKey: 'saveHistory', defaultTrue: true },
];

export const SETTINGS_FORM_NUMBER_BINDINGS: NumberBinding[] = [
  { elementKey: 'temperature', configKey: 'temperature', fallback: 0.7, parseMode: 'float' },
  { elementKey: 'maxTokens', configKey: 'maxTokens', fallback: 4096, parseMode: 'int' },
  { elementKey: 'contextLimit', configKey: 'contextLimit', fallback: 200000, parseMode: 'int' },
  { elementKey: 'timeout', configKey: 'timeout', fallback: 30000, parseMode: 'int' },
];
