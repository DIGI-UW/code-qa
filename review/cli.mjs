#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { createPlan, validatePlan } from './plan.mjs';
import { runReview, exitCode } from './run.mjs';
import { OpenELISEnvironment } from './environments/openelis.mjs';

const help = `code-qa v0.1 (Node 20+)
  plan --repo PATH --base REF --head REF --out plan.json
       [--application pr|targeted --question TEXT] [--path PATH ...] [--context PATH ...]
       [--purpose TEXT --requirements FILE] [--environment none|openelis]
       [--rigor standard --adapter codex --model MODEL --billing-mode subscription|api|unknown]
       [--review-seconds 300 --startup-seconds 3600 --max-context-bytes 200000]
  run --plan plan.json --out /durable/artifacts
  cleanup --run /durable/artifacts/RUN_ID

Mechanical is the default: no model credentials/calls. OpenELIS needs Lima 2+ and a
public OpenELIS commit. First use downloads a Linux image and build dependencies.
Standard uses one packet-only Codex session. No hard token/currency cap is claimed.
Run exit codes: 0 complete (inspect assessment), 2 partial/error, 3 cancelled/stale.
No code repair, PR publication or merge is performed.\n`;

try {
  const { values, positionals } = parseArgs({ allowPositionals: true, strict: true, options: {
    help: { type: 'boolean' }, repo: { type: 'string' }, base: { type: 'string' }, head: { type: 'string' },
    out: { type: 'string' }, plan: { type: 'string' }, run: { type: 'string' }, application: { type: 'string' },
    question: { type: 'string' }, purpose: { type: 'string' }, requirements: { type: 'string' },
    path: { type: 'string', multiple: true }, context: { type: 'string', multiple: true }, environment: { type: 'string' },
    rigor: { type: 'string' }, adapter: { type: 'string' }, model: { type: 'string' }, 'billing-mode': { type: 'string' },
    'review-seconds': { type: 'string' }, 'startup-seconds': { type: 'string' }, 'max-context-bytes': { type: 'string' },
  } });
  const action = positionals[0];
  if (values.help || !action) { console.log(help); process.exit(0); }
  if (positionals.length !== 1) throw new Error('Expected one command');
  if (action === 'plan') {
    if (!values.repo || !values.base || !values.head || !values.out) throw new Error('plan requires --repo, --base, --head, --out');
    const plan = await createPlan({ repo: values.repo, base: values.base, head: values.head, application: values.application,
      question: values.question, purpose: values.purpose, requirements: values.requirements ? await readFile(values.requirements, 'utf8') : '',
      paths: values.path, contextPaths: values.context, environment: values.environment, rigor: values.rigor, adapter: values.adapter,
      model: values.model, billingMode: values['billing-mode'],
      ...(values['review-seconds'] ? { reviewSeconds: Number(values['review-seconds']) } : {}),
      ...(values['startup-seconds'] ? { startupSeconds: Number(values['startup-seconds']) } : {}),
      ...(values['max-context-bytes'] ? { maxContextBytes: Number(values['max-context-bytes']) } : {}),
    });
    const out = resolve(values.out);
    await mkdir(dirname(out), { recursive: true, mode: 0o700 });
    await writeFile(out, JSON.stringify(plan, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    console.log(JSON.stringify({ plan: out, ...plan }, null, 2));
  } else if (action === 'run') {
    if (!values.plan || !values.out) throw new Error('run requires --plan and --out');
    const plan = JSON.parse(await readFile(values.plan, 'utf8'));
    const controller = new AbortController();
    for (const sig of ['SIGINT', 'SIGTERM']) process.once(sig, () => controller.abort());
    const result = await runReview(plan, resolve(values.out), { signal: controller.signal,
      onProgress: phase => console.error(`[code-qa] ${phase}`) });
    console.log(JSON.stringify({ directory: result.directory, status: result.run.status, assessment: result.run.assessment, reasons: result.run.reasons }, null, 2));
    process.exitCode = exitCode(result.run);
  } else if (action === 'cleanup') {
    if (!values.run) throw new Error('cleanup requires --run');
    const directory = resolve(values.run), plan = validatePlan(JSON.parse(await readFile(join(directory, 'plan.json'), 'utf8')));
    if (directory.split('/').at(-1) !== plan.id || plan.environment !== 'openelis') throw new Error('Run directory does not identify an OpenELIS worker');
    const environment = new OpenELISEnvironment(plan, directory);
    environment.owned = true;
    console.log(await environment.cleanup());
  } else throw new Error(`Unknown command: ${action}`);
} catch (error) { console.error(error.message); process.exitCode = 2; }
