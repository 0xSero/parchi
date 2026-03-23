import { sidePanelProto, toolIcons } from './panel-tools-shared.js';

sidePanelProto.getToolIcon = function getToolIcon(toolName: string): string {
  if (toolIcons[toolName]) return toolIcons[toolName];
  for (const [key, icon] of Object.entries(toolIcons)) {
    if (key === 'default') continue;
    const searchKey = key.replace(/^browser_/, '');
    if (toolName.toLowerCase().includes(searchKey.toLowerCase())) {
      return icon;
    }
  }
  return toolIcons.default;
};

sidePanelProto.getArgsTokens = function getArgsTokens(args: any): string[] {
  if (!args || typeof args !== 'object') return [];
  const tokens: string[] = [];

  if (args.url) {
    tokens.push(
      String(args.url)
        .replace(/^https?:\/\//, '')
        .substring(0, 36),
    );
  }
  if (args.path) tokens.push(String(args.path).substring(0, 36));
  if (args.selector) tokens.push(String(args.selector).substring(0, 40));
  if (args.text) {
    const value = String(args.text);
    tokens.push(`"${value.substring(0, 24)}${value.length > 24 ? '…' : ''}"`);
  }
  if (args.query) {
    const value = String(args.query);
    tokens.push(`"${value.substring(0, 24)}${value.length > 24 ? '…' : ''}"`);
  }
  if (args.key) tokens.push(`key ${args.key}`);
  if (args.direction) tokens.push(`scroll ${args.direction}`);
  if (args.type) tokens.push(String(args.type));

  const noiseKeys = new Set(['tabId', 'timeoutMs', 'timeout', '_']);
  const keys = Object.keys(args).filter(
    (key) => !key.startsWith('_') && !noiseKeys.has(key) && !tokens.join(' ').includes(key),
  );
  if (tokens.length === 0 && keys.length === 1) {
    tokens.push(String(args[keys[0]]).substring(0, 30));
  } else if (tokens.length === 0 && keys.length > 1) {
    tokens.push(`${keys.length} params`);
  }

  return tokens;
};
