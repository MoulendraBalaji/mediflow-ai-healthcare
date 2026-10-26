import test from 'node:test';
import assert from 'node:assert/strict';

// Set test-safe configuration before the agent module reads env.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgresql://postgres@localhost:5432/mediflow_test';
process.env.JWT_SECRET = 'test-only-secret-that-is-long-enough-1234567890';
process.env.GROQ_API_KEY = '';
process.env.DEMO_MODE = 'false';

const { detectRedFlags } = await import('../../src/agents/navigatorAgent.js');

test('chest pain and inability to breathe are both emergency red flags', () => {
  const flags = detectRedFlags(["chest pain, can't breathe"], []);
  assert.deepEqual(flags.sort(), ['Cannot breathe', 'Chest pain']);
});

test('stroke warning signs are caught without a model', () => {
  const flags = detectRedFlags(['sudden weakness and slurred speech'], []);
  assert.ok(flags.includes('Possible stroke'));
});

test('recorded conditions are screened as well as symptoms', () => {
  const flags = detectRedFlags([], ['severe allergic reaction']);
  assert.deepEqual(flags, ['Severe allergic reaction']);
});

test('benign symptoms do not trigger an emergency', () => {
  assert.deepEqual(detectRedFlags(['mild knee pain after a walk'], []), []);
});

test('red-flag matching is case insensitive', () => {
  assert.deepEqual(detectRedFlags(['CHEST PAIN'], []), ['Chest pain']);
});
