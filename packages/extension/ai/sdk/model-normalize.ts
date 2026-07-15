// Model ID normalization utilities
import { inferOpenRouterNamespace, stripRouterPrefix } from '../providers/model-family.js';

export function normalizeOpenRouterModelId(modelId: string): string {
  const model = stripRouterPrefix(modelId.trim());
  return inferOpenRouterNamespace(model);
}
