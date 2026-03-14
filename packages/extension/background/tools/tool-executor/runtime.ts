import type { ServiceContext } from '../../service-context.js';
import type { SessionState } from '../../service-types.js';
import type { ToolExecutionArgs, ToolExecutionOptions } from './shared.js';

export function createToolRuntimeEmitter(
  ctx: Pick<ServiceContext, 'sendRuntime'>,
  options: ToolExecutionOptions,
  sessionState: SessionState,
  toolName: string,
  args: ToolExecutionArgs,
  callId: string,
) {
  const computeCurrentStepMeta = () => {
    const steps = sessionState.currentPlan?.steps || [];
    const currentIndex = steps.findIndex((step) => step.status !== 'done');
    if (currentIndex < 0) return {};
    const step = steps[currentIndex];
    return { stepIndex: currentIndex, stepTitle: step?.title || undefined };
  };

  return {
    sendStart() {
      ctx.sendRuntime(options.runMeta, {
        type: 'tool_execution_start',
        tool: toolName,
        id: callId,
        args,
        ...(options.runtimeMeta || {}),
        ...computeCurrentStepMeta(),
      });
    },
    sendResult(result: unknown) {
      ctx.sendRuntime(options.runMeta, {
        type: 'tool_execution_result',
        tool: toolName,
        id: callId,
        args,
        result,
        ...(options.runtimeMeta || {}),
        ...computeCurrentStepMeta(),
      });
    },
  };
}
