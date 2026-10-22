import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { command, requireSuccess } from '../../review/process.mjs';

// Response shapes from OpenELIS's CustomFormAuthenticationSuccessHandler and
// CustomAuthenticationFailureHandler at 556f35d. Exercise the real Python HTTP probe.
test('OpenELIS probe recognizes its API contract and rejects misleading failure responses', async t => {
  let badLogin = { status: 401, body: { error: 'error.invalidcredentials' } };
  const requests = [];
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const data = new URLSearchParams(Buffer.concat(chunks).toString());
    requests.push({ method: request.method, url: request.url, user: data.get('loginName') });
    if (request.url === '/login') {
      response.end('<html><div id="root"></div></html>');
      return;
    }
    if (request.url !== '/api/OpenELIS-Global/ValidateLogin?apiCall=true' || request.method !== 'POST' || data.get('loginName') !== 'admin') {
      response.writeHead(404); response.end('{}'); return;
    }
    const result = data.get('password') === 'adminADMIN!' ? { status: 200, body: { success: true } } : badLogin;
    response.writeHead(result.status, { 'content-type': 'application/json' });
    response.end(JSON.stringify(result.body));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const script = fileURLToPath(new URL('../../review/environments/openelis-smoke.py', import.meta.url));
  const base = `http://127.0.0.1:${server.address().port}`;
  const run = async () => JSON.parse(requireSuccess(await command(['python3', '-B', '-c',
    'import json,runpy,sys; print(json.dumps(runpy.run_path(sys.argv[1])["probe"](sys.argv[2])))', script, base]), 'probe').stdout);
  const passing = await run();
  assert.equal(passing.length, 3);
  assert.ok(passing.every(a => a.passed));
  assert.equal(passing[1].httpStatus, 401);
  assert.equal(passing[1].errorCode, 'error.invalidcredentials');
  assert.deepEqual(requests.map(r => r.method), ['POST', 'POST', 'GET']);
  for (const wrong of [
    { status: 200, body: { success: true } },
    { status: 500, body: { error: 'error.invalidcredentials' } },
    { status: 401, body: { error: 'error.lockedCredentials' } },
    { status: 401, body: { success: false } },
  ]) {
    badLogin = wrong;
    const assertions = await run();
    assert.equal(assertions[0].passed, true);
    assert.equal(assertions[1].passed, false, JSON.stringify(wrong));
    assert.equal(assertions[2].passed, true);
  }
});
