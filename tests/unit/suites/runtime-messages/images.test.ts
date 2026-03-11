import { RUNTIME_MESSAGE_SCHEMA_VERSION, isRuntimeMessage } from '@parchi/shared';
import { type TestRunner, log } from '../../shared/runner.js';

export function runRuntimeMessagesImagesSuite(runner: TestRunner) {
  log('\n=== Testing Runtime Message Images ===', 'info');

  runner.test('report_image_captured message serializes and deserializes correctly', () => {
    const message = {
      schemaVersion: RUNTIME_MESSAGE_SCHEMA_VERSION,
      type: 'report_image_captured' as const,
      runId: 'run-test',
      sessionId: 'session-test',
      timestamp: Date.now(),
      image: {
        id: 'img-123',
        dataUrl:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        capturedAt: Date.now(),
        toolCallId: 'tool-456',
        tabId: 42,
        url: 'https://example.com/page',
        title: 'Example Page',
        visionDescription: 'A screenshot of the example page',
        selected: true,
      },
      images: [
        {
          id: 'img-123',
          capturedAt: Date.now(),
          url: 'https://example.com/page',
          title: 'Example Page',
          tabId: 42,
          visionDescription: 'A screenshot of the example page',
          selected: true,
        },
      ],
      selectedImageIds: ['img-123'],
    };
    const json = JSON.stringify(message);
    const parsed = JSON.parse(json);
    runner.assertTrue(isRuntimeMessage(parsed), 'report_image_captured should validate');
    runner.assertEqual(parsed.type, 'report_image_captured', 'Type should be preserved');
    runner.assertEqual(parsed.image.id, 'img-123', 'Image ID should be preserved');
    runner.assertEqual(parsed.image.selected, true, 'Selected flag should be preserved');
    runner.assertEqual(parsed.selectedImageIds.length, 1, 'Selected image IDs should be preserved');
  });

  runner.test('report_images_selection message serializes and deserializes correctly', () => {
    const message = {
      schemaVersion: RUNTIME_MESSAGE_SCHEMA_VERSION,
      type: 'report_images_selection' as const,
      runId: 'run-test',
      sessionId: 'session-test',
      timestamp: Date.now(),
      images: [
        {
          id: 'img-1',
          capturedAt: Date.now() - 1000,
          url: 'https://example.com/page1',
          title: 'Page 1',
          tabId: 1,
          visionDescription: 'First screenshot',
          selected: false,
        },
        {
          id: 'img-2',
          capturedAt: Date.now(),
          url: 'https://example.com/page2',
          title: 'Page 2',
          tabId: 2,
          visionDescription: 'Second screenshot',
          selected: true,
        },
      ],
      selectedImageIds: ['img-2'],
    };
    const json = JSON.stringify(message);
    const parsed = JSON.parse(json);
    runner.assertTrue(isRuntimeMessage(parsed), 'report_images_selection should validate');
    runner.assertEqual(parsed.type, 'report_images_selection', 'Type should be preserved');
    runner.assertEqual(parsed.images.length, 2, 'Images array should be preserved');
    runner.assertEqual(parsed.selectedImageIds[0], 'img-2', 'Selected image IDs should be preserved');
    runner.assertEqual(parsed.images[0].selected, false, 'First image should be unselected');
    runner.assertEqual(parsed.images[1].selected, true, 'Second image should be selected');
  });
}
