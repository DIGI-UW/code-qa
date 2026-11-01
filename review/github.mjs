import {isStackFresh} from './stack.mjs';
import { mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { command, requireSuccess } from './process.mjs';
import { git } from './snapshot.mjs';

export function parsePR(url) {
  const match = /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/pull\/([1-9]\d*)\/?$/.exec(url);
  if (!match || ['.', '..'].includes(match[1]) || ['.', '..'].includes(match[2])) throw new Error('Use a github.com pull request URL');
  return { repository: match[1] + '/' + match[2], number: Number(match[3]), url: url.replace(/\/$/, '') };
}
async function gh(args, execute = command) { return requireSuccess(await execute(['gh', ...args]), 'GitHub').stdout; }
export async function readPR(identity, execute = command) {
  const info = JSON.parse(await gh(['pr', 'view', String(identity.number), '--repo', identity.repository, '--json',
    'number,url,title,body,baseRefName,baseRefOid,headRefName,headRefOid,state'], execute));
  return { ...identity, ...info };
}
export async function collectConversation(identity, execute = command) {
  const [owner, name] = identity.repository.split('/');
  const query = `query($owner:String!,$name:String!,$number:Int!,$cursor:String) {
    repository(owner:$owner,name:$name) { pullRequest(number:$number) {
      reviewThreads(first:100,after:$cursor) { pageInfo { hasNextPage endCursor }
        nodes { id isResolved isOutdated path comments(first:100) {
          pageInfo { hasNextPage } nodes { id url body createdAt author { login } authorAssociation originalCommit { oid } commit { oid } }
        } }
      }
    } }
  }`;
  const threads = [], gaps = [];
  let cursor;
  do {
    const args = ['api', 'graphql', '-f', 'query=' + query, '-f', 'owner=' + owner, '-f', 'name=' + name, '-F', 'number=' + identity.number];
    if (cursor) args.push('-f', 'cursor=' + cursor);
    const response = JSON.parse(await gh(args, execute));
    if (response.errors) throw new Error('GitHub conversation query failed');
    const page = response.data.repository.pullRequest.reviewThreads;
    for (const thread of page.nodes) {
      if (thread.comments.pageInfo.hasNextPage) gaps.push('Thread ' + thread.id + ' has additional unavailable comments');
      threads.push(thread);
    }
    cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (cursor);
  const discussion = JSON.parse(await gh(['pr', 'view', String(identity.number), '--repo', identity.repository, '--json', 'comments,reviews,closingIssuesReferences'], execute));
  return { retrievedAt: new Date().toISOString(), authority: 'context-only; explicit operator decisions determine accepted intent', threads, ...discussion, gaps };
}
export async function collectPR(url, repoPath, execute = command) {
  const identity = parsePR(url), info = await readPR(identity, execute);
  if (info.state !== 'OPEN') throw new Error('PR is not open; use explicit base/head for a historical review');
  const repo = resolve(repoPath ?? join(homedir(), '.cache', 'code-qa', ...identity.repository.split('/')));
  if (!repoPath) {
    await mkdir(repo, { recursive: true });
    await git(repo, ['init', '--bare']);
  }
  // Explicit URL and SHA fetches do not alter the user's checkout or branch refs.
  await git(repo, ['fetch', '--no-tags', '--no-recurse-submodules', 'https://github.com/' + identity.repository + '.git', info.baseRefOid, info.headRefOid]);
  const after = await readPR(identity, execute);
  if (after.baseRefOid !== info.baseRefOid || after.headRefOid !== info.headRefOid) throw new Error('PR moved during collection; plan again');
  let checks = [], checksWarning = '';
  try {
    const result = await execute(['gh','pr','checks',String(identity.number),'--repo',identity.repository,'--json','name,state,bucket,link']);
    if (![0,1,8].includes(result.code)) requireSuccess(result, 'Collect PR checks');
    checks = JSON.parse(result.stdout);
  } catch (error) { checksWarning = error.message; }
  let conversation;
  try { conversation = await collectConversation(identity, execute); }
  catch (error) { conversation = { threads: [], gaps: ['Conversation unavailable: ' + error.message], retrievedAt: new Date().toISOString() }; }
  return { repo, base: info.baseRefOid, head: info.headRefOid, pullRequest: { ...info, conversation, observedAt: new Date().toISOString(), checks, checksWarning } };
}
export async function isPRFresh(plan, execute = command) {
  if (plan.stack) return isStackFresh(plan, execute);
  if (!plan.pullRequest) return true;
  const current = await readPR(plan.pullRequest, execute);
  return current.state === 'OPEN' && current.baseRefOid === plan.snapshot.base && current.headRefOid === plan.snapshot.head;
}
