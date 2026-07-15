import { getToolsForSession } from '../../../packages/extension/background/tools/tool-catalog.js';
import {
  getBrowserToolDefinitions,
  getBrowserToolMap,
} from '../../../packages/extension/tools/browser-tool-definitions.js';
import { type TestRunner, log } from '../shared/runner.js';

export async function runToolDefinitionsSuite(runner: TestRunner) {
  log('\n=== Testing Tool Definitions ===', 'info');

  await runner.test('Real browser tool definitions have required fields', () => {
    const definitions = getBrowserToolDefinitions(true);
    definitions.forEach((tool) => {
      runner.assertTrue(tool.name, 'Tool must have name');
      runner.assertTrue(tool.description, 'Tool must have description');
      runner.assertTrue(tool.input_schema, 'Tool must have input_schema');
      runner.assertTrue(tool.input_schema?.type === 'object', 'Schema type must be object');
      runner.assertTrue(tool.input_schema?.properties, 'Schema must have properties');
    });
  });

  await runner.test('Tool availability map matches real definitions', () => {
    const definitions = getBrowserToolDefinitions(true);
    const toolMap = getBrowserToolMap(true);
    const definitionNames = definitions.map((tool) => tool.name).sort();
    const mapNames = Object.keys(toolMap).sort();

    runner.assertEqual(JSON.stringify(mapNames), JSON.stringify(definitionNames), 'Tool map should mirror definitions');
  });

  await runner.test('Vision tools are included in the real tool map', () => {
    const toolMap = getBrowserToolMap(true);
    runner.assertTrue(toolMap.watchVideo === true, 'watchVideo should be executable');
    runner.assertTrue(toolMap.getVideoInfo === true, 'getVideoInfo should be executable');
  });

  await runner.test('Tab-group constrained definition set omits groupTabs', () => {
    const definitions = getBrowserToolDefinitions(false);
    runner.assertFalse(
      definitions.some((tool) => tool.name === 'groupTabs'),
      'groupTabs should be omitted when unsupported',
    );
  });

  await runner.test('Screenshot remains available without vision tools when screenshots are enabled', () => {
    const tools = getToolsForSession(
      {
        getToolDefinitions: () => getBrowserToolDefinitions(true),
      },
      { enableScreenshots: true },
      false,
      [],
      false,
    );

    runner.assertTrue(
      tools.some((tool) => tool.name === 'screenshot'),
      'screenshot should stay available',
    );
    runner.assertFalse(
      tools.some((tool) => tool.name === 'watchVideo'),
      'watchVideo should be hidden',
    );
    runner.assertFalse(
      tools.some((tool) => tool.name === 'getVideoInfo'),
      'getVideoInfo should be hidden',
    );
  });

  await runner.test('Screenshot is removed only when screenshots are explicitly disabled', () => {
    const tools = getToolsForSession(
      {
        getToolDefinitions: () => getBrowserToolDefinitions(true),
      },
      { enableScreenshots: false },
      false,
      [],
      true,
    );

    runner.assertFalse(
      tools.some((tool) => tool.name === 'screenshot'),
      'screenshot should be disabled',
    );
  });
}
