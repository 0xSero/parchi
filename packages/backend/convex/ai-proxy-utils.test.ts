import assert from 'node:assert/strict';
import test from 'node:test';
import { usageObjectToTokenCount } from './ai-proxy-utils.js';

test('a zero cache write does not hide cache read tokens', () => {
  assert.equal(
    usageObjectToTokenCount({
      input_tokens: 10,
      output_tokens: 5,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 4000,
    }),
    4015,
  );
});

test('cache write and cache read both count when total_tokens is absent', () => {
  assert.equal(
    usageObjectToTokenCount({
      input_tokens: 10,
      output_tokens: 5,
      cache_creation_input_tokens: 100,
      cache_read_input_tokens: 4000,
    }),
    4115,
  );
});

test('an explicit total_tokens still wins', () => {
  assert.equal(
    usageObjectToTokenCount({
      total_tokens: 50,
      input_tokens: 1,
      cache_read_input_tokens: 9,
    }),
    50,
  );
});

test('a lone cache read is still counted', () => {
  assert.equal(usageObjectToTokenCount({ cache_read_input_tokens: 8 }), 8);
});

test('a lone cache write is still counted', () => {
  assert.equal(usageObjectToTokenCount({ cache_creation_input_tokens: 12 }), 12);
});

test('prompt and completion still add', () => {
  assert.equal(usageObjectToTokenCount({ input_tokens: 3, output_tokens: 4 }), 7);
});

test('an empty usage object stays unknown', () => {
  assert.equal(usageObjectToTokenCount({}), null);
});
