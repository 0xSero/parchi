import { classifyApiError } from '../../../packages/extension/ai/errors/classifier.js';
import { type TestRunner, log } from '../shared/runner.js';

export function runApiErrorClassificationSuite(runner: TestRunner) {
  log('\n=== Testing API Error Classification ===', 'info');

  runner.test('404 route errors are not mislabeled as model errors', () => {
    const classified = classifyApiError({
      statusCode: 404,
      message: 'Not Found',
      responseBody: '{"error":"Route not found: /ai-proxy/openrouter/chat/completions"}',
    });
    runner.assertEqual(classified.category, 'server');
  });

  runner.test('Model missing responses classify as model errors', () => {
    const classified = classifyApiError({
      statusCode: 404,
      message: 'Not Found',
      responseBody: '{"error":{"message":"The model `openai/not-real` does not exist"}}',
    });
    runner.assertEqual(classified.category, 'model');
  });

  runner.test('402 entitlement responses classify as managed-access issues', () => {
    const classified = classifyApiError({
      statusCode: 402,
      message: 'Payment Required',
      responseBody:
        '{"error":"Managed billing is not active. Open Account & Billing to start or manage your Stripe plan."}',
    });
    runner.assertEqual(classified.category, 'auth');
    runner.assertTrue(
      String(classified.action || '')
        .toLowerCase()
        .includes('account & billing'),
    );
  });

  runner.test('Managed proxy auth errors avoid BYOK-only guidance', () => {
    const classified = classifyApiError({
      statusCode: 401,
      message: 'Unauthorized',
      responseBody: '{"error":"Unauthorized at /ai-proxy/openrouter/v1/chat/completions"}',
    });
    runner.assertEqual(classified.category, 'auth');
    runner.assertTrue(
      String(classified.message || '')
        .toLowerCase()
        .includes('managed runtime'),
    );
    runner.assertFalse(
      String(classified.action || '')
        .toLowerCase()
        .includes('check your api key in settings'),
    );
  });

  runner.test('Paid/parchi auth errors avoid BYOK guidance even without ai-proxy text', () => {
    const classified = classifyApiError(
      {
        statusCode: 401,
        message: 'Incorrect API key provided',
        responseBody: '{"error":{"message":"Incorrect API key provided"}}',
      },
      {
        route: 'proxy',
        provider: 'openrouter',
        model: 'parchi/moonshotai/kimi-k2.5',
        useProxy: true,
      },
    );
    runner.assertEqual(classified.category, 'auth');
    runner.assertTrue(
      String(classified.message || '')
        .toLowerCase()
        .includes('managed runtime'),
    );
    runner.assertFalse(
      String(classified.action || '')
        .toLowerCase()
        .includes('check your api key in settings'),
    );
  });

  runner.test('Managed proxy invalid key points to backend OPENROUTER_API_KEY fix', () => {
    const classified = classifyApiError(
      {
        statusCode: 401,
        message: 'Unauthorized',
        responseBody: '{"error":{"message":"Incorrect API key provided"}}',
      },
      {
        route: 'proxy',
        provider: 'openrouter',
        model: 'parchi/moonshotai/kimi-k2.5',
        useProxy: true,
      },
    );
    runner.assertEqual(classified.category, 'auth');
    runner.assertTrue(
      String(classified.message || '')
        .toLowerCase()
        .includes('managed runtime key'),
    );
    runner.assertTrue(String(classified.action || '').includes('OPENROUTER_API_KEY'));
  });

  runner.test('Managed proxy JWT parse failures classify as auth instead of server', () => {
    const classified = classifyApiError(
      {
        statusCode: 500,
        message: 'Internal Server Error',
        responseBody:
          '{"code":"Server Error: Could not parse JWT payload. Check that the token is a valid JWT format with three base64-encoded parts separated by dots."}',
      },
      {
        route: 'proxy',
        provider: 'parchi',
        model: 'moonshotai/kimi-k2.5',
        useProxy: true,
      },
    );
    runner.assertEqual(classified.category, 'auth');
    runner.assertTrue(
      String(classified.message || '')
        .toLowerCase()
        .includes('session'),
    );
  });

  runner.test('Missing managed server key points to backend env setup', () => {
    const classified = classifyApiError(
      {
        statusCode: 500,
        message: 'Missing OPENROUTER_API_KEY',
      },
      {
        route: 'proxy',
        provider: 'openrouter',
        useProxy: true,
      },
    );
    runner.assertEqual(classified.category, 'auth');
    runner.assertTrue(
      String(classified.message || '')
        .toLowerCase()
        .includes('missing server credentials'),
    );
    runner.assertTrue(String(classified.action || '').includes('OPENROUTER_API_KEY'));
  });

  runner.test('OAuth auth failures recommend reconnecting OAuth (not BYOK)', () => {
    const classified = classifyApiError(
      {
        statusCode: 401,
        message: 'Unauthorized',
        responseBody: '{"error":{"message":"Invalid authentication"}}',
      },
      {
        route: 'oauth',
        provider: 'codex-oauth',
        model: 'gpt-5.3-codex',
      },
    );
    runner.assertEqual(classified.category, 'auth');
    runner.assertTrue(
      String(classified.message || '')
        .toLowerCase()
        .includes('oauth authentication failed'),
    );
    runner.assertTrue(
      String(classified.action || '')
        .toLowerCase()
        .includes('settings > oauth'),
    );
    runner.assertFalse(
      String(classified.action || '')
        .toLowerCase()
        .includes('check your api key in settings'),
    );
  });

  runner.test('OAuth model failures suggest raw model IDs (no provider prefix)', () => {
    const classified = classifyApiError(
      {
        statusCode: 400,
        message: 'Bad Request',
        responseBody:
          '{"error":{"message":"The requested model is not supported.","code":"model_not_supported","type":"invalid_request_error"}}',
      },
      {
        route: 'oauth',
        provider: 'copilot-oauth',
        model: 'copilot/claude-sonnet-4',
      },
    );
    runner.assertEqual(classified.category, 'model');
    runner.assertTrue(
      String(classified.action || '')
        .toLowerCase()
        .includes('no provider/ prefix'),
    );
  });

  runner.test('OAuth permission scope failures do not get mislabeled as expired OAuth', () => {
    const classified = classifyApiError(
      {
        statusCode: 403,
        message: 'Forbidden',
        responseBody:
          '{"error":"You have insufficient permissions for this operation. Missing scopes: api.model.read."}',
      },
      {
        route: 'oauth',
        provider: 'codex-oauth',
        model: 'gpt-5.3-codex',
      },
    );
    runner.assertEqual(classified.category, 'auth');
    runner.assertTrue(
      String(classified.message || '')
        .toLowerCase()
        .includes('lacks required api permissions'),
    );
    runner.assertFalse(
      String(classified.message || '')
        .toLowerCase()
        .includes('oauth authentication failed'),
    );
  });

  runner.test('OAuth quota failures classify as rate limit (not auth)', () => {
    const classified = classifyApiError(
      {
        statusCode: 403,
        message: 'Forbidden',
        responseBody:
          '{"error":{"message":"You exceeded your current quota, please check your plan and billing details.","type":"insufficient_quota"}}',
      },
      {
        route: 'oauth',
        provider: 'codex-oauth',
        model: 'gpt-5.3-codex',
      },
    );
    runner.assertEqual(classified.category, 'rate_limit');
    runner.assertTrue(
      String(classified.message || '')
        .toLowerCase()
        .includes('quota'),
    );
    runner.assertFalse(
      String(classified.message || '')
        .toLowerCase()
        .includes('oauth authentication failed'),
    );
  });
}
