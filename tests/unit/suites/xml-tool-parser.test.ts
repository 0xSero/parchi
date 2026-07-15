import {
  buildPlanFromArgs as buildPlanFromToolArgs,
  extractXmlToolCalls as extractXmlToolCallsFromTools,
} from '../../../packages/extension/background/tools/xml-tool-parser.js';
import {
  buildPlanFromArgs,
  coerceXmlArgValue,
  extractXmlArgs,
  extractXmlToolCalls,
  extractXmlToolName,
  parsePlanSteps,
  stripXmlToolCalls,
} from '../../../packages/extension/background/xml-tool-parser.js';
import { type TestRunner, log } from '../shared/runner.js';

export async function runXmlToolParserSuite(runner: TestRunner) {
  log('\n=== Testing XML Tool Parser ===', 'info');

  await runner.test('extractXmlToolCalls parses block, inline, and fallback argkey syntax', () => {
    const block =
      '<tool_call><tool_name>navigate</tool_name><argkey>url</argkey><argvalue>https://example.com</argvalue></tool_call>';
    const inline = 'click<argkey>selector</argkey><argvalue>#submit</argvalue></tool_call>';
    const fallback = '<argkey>direction</argkey><argvalue>down</argvalue><tool>scroll</tool>';

    const calls = extractXmlToolCalls(`${block}\n${inline}`);
    runner.assertEqual(calls.length, 2);
    runner.assertEqual(calls[0]?.name, 'navigate');
    runner.assertEqual(calls[1]?.args, { selector: '#submit' });
    runner.assertEqual(extractXmlToolCalls(fallback)[0]?.name, 'scroll');
    runner.assertEqual(extractXmlToolCallsFromTools(block), calls.slice(0, 1));
  });

  await runner.test('extractXmlToolName and extractXmlArgs handle named args and coercion', () => {
    const block =
      '<tool_call><function>set_plan</function><arg name="steps">["One","Two"]</arg><arg name="retry">true</arg></tool_call>';

    runner.assertEqual(extractXmlToolName(block), 'set_plan');
    runner.assertEqual(extractXmlArgs(block), { steps: ['One', 'Two'], retry: true });
    runner.assertEqual(coerceXmlArgValue('42'), 42);
    runner.assertEqual(coerceXmlArgValue('{"ok":true}'), { ok: true });
    runner.assertEqual(coerceXmlArgValue('false'), false);
    runner.assertEqual(coerceXmlArgValue('   '), '');
    runner.assertEqual(coerceXmlArgValue('plain-text'), 'plain-text');
    runner.assertEqual(coerceXmlArgValue(''), '');
  });

  await runner.test('stripXmlToolCalls removes tool markup and parsePlanSteps normalizes lines', () => {
    const cleaned = stripXmlToolCalls(
      'Before <tool_call><name>click</name><argkey>selector</argkey><argvalue>#x</argvalue></tool_call> After',
    );
    runner.assertEqual(cleaned, 'Before  After');
    runner.assertEqual(parsePlanSteps('- First\n2. Second\n  3) Third'), ['First', 'Second', 'Third']);
    runner.assertEqual(parsePlanSteps(''), []);
    runner.assertEqual(stripXmlToolCalls('plain text'), 'plain text');
  });

  await runner.test('buildPlanFromArgs prefers explicit steps and preserves existing createdAt', () => {
    const existing = buildPlanFromArgs({ steps: [{ title: 'Existing', status: 'done' }] });
    const plan = buildPlanFromArgs(
      {
        steps: [
          { title: 'Use explicit steps', status: 'running' },
          { title: 'Second explicit step', status: 'blocked' },
        ],
        plan: '- Ignored text plan',
      },
      existing,
    );

    runner.assertEqual(
      plan?.steps.map((step) => step.title),
      ['Use explicit steps', 'Second explicit step'],
    );
    runner.assertEqual(plan?.steps[0]?.status, 'running');
    runner.assertEqual(plan?.createdAt, existing?.createdAt);
    runner.assertEqual(buildPlanFromToolArgs({ plan: '1. One\n2. Two' })?.steps.length, 2);
    runner.assertEqual(buildPlanFromArgs({}), null);
    runner.assertEqual(extractXmlToolName('<tool_call><argkey>url</argkey></tool_call>'), '');
  });
}
