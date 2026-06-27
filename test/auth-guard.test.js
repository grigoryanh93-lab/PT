import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('protected application shell is hidden in initial HTML before auth resolves', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /<nav class="app-nav" aria-label="Main pages" hidden>/);
  assert.match(html, /<header class="hero" hidden>/);
  assert.match(html, /<section class="stats" aria-label="Patient statistics" hidden>/);
  assert.match(html, /<section class="page" data-page="dashboard" hidden>/);
});

test('production without Supabase still requires auth instead of loading demo data', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /allowLocalDemoMode = !isSupabaseConfigured && isLocalDemoHost/);
  assert.match(main, /sharedMode = isSupabaseConfigured \|\| !allowLocalDemoMode/);
  assert.match(main, /let patients = allowLocalDemoMode \? loadPatients\(\) : \[\]/);
  assert.match(main, /function ProtectedRoute\(renderProtectedApp\)/);
  assert.match(main, /if \(!session\) \{/);
});
