import {readFile, mkdir, realpath, stat, rename, unlink} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {createReadStream} from 'node:fs';
import {promisify} from 'node:util';
import {randomUUID, createHash} from 'node:crypto';
import path from 'node:path';
import {atomicJSON} from './storage.mjs';
import {githubRepository} from './updates.mjs';

const exec = promisify(execFile), sha = value => /^[a-f\d]{40}$/i.test(value || '');
const inside = (root, file) => {const rel = path.relative(root, file); return rel === '' || !path.isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + path.sep);};
const activeStates = new Set(['queued', 'checking', 'backing_up', 'fetching', 'applying', 'restoring']);
const installFile = name => /(^|\/)(requirements[^/]*\.(txt|in)|pyproject\.toml|setup\.(py|cfg)|install\.(py|sh|bat|cmd|ps1)|environment[^/]*\.(yml|yaml)|package(-lock)?\.json|uv\.lock|\.gitmodules)$/i.test(name);
// A project version bump alone does not change installation requirements.
export function projectVersionOnly(before, after) {
 const normalize = value => {
  let section = '', matches = 0;
  const lines = value.replace(/\r\n/g, '\n').split('\n').map(line => {
   if (/^\s*\[/.test(line)) section = line.trim();
   if (section === '[project]' && /^\s*version\s*=\s*(["'])[a-z\d.+_-]+\1\s*(?:#.*)?$/i.test(line)) {matches++; return 'version = "<project-version>"';}
   return line;
  });
  return matches === 1 ? lines.join('\n') : null;
 };
 const a = normalize(before), b = normalize(after);
 return a !== null && b !== null && a === b;
}
const error = code => Object.assign(Error(code), {code});
async function fileHash(file) {const hash = createHash('sha256'); for await (const chunk of createReadStream(file)) hash.update(chunk); return hash.digest('hex');}

export function createNodeUpdates({root, candidates, isBusy, engine, changed = async () => {}, now = Date.now, runGit: injectedGit, enabled = true} = {}) {
 const folder = path.resolve(root, 'data', 'node-update-backups'), journal = path.resolve(root, 'data', 'node-update-jobs.json');
 let db = {schema: 'artoftomworks.node-updates', jobs: [], needsRestart: false}, initializing, active = false, closed = false, stopping = false;
 const plans = new Map(), controllers = new Set();
 async function init() {
  if (!initializing) initializing = (async () => {
   try {if ((await stat(journal)).size > 8 * 1024**2) return; const saved = JSON.parse(await readFile(journal, 'utf8')); if (saved.schema === db.schema && Array.isArray(saved.jobs)) db = saved;} catch {}
   let interrupted = false;
   for (const job of db.jobs) {if (activeStates.has(job.state)) {job.state = 'interrupted'; interrupted = true;} for (const row of job.rows) if (activeStates.has(row.state)) {row.state = 'failed'; row.reason = 'interrupted'; interrupted = true;}}
   if (interrupted) await save();
  })();
  await initializing;
 }
 const save = () => atomicJSON(journal, db);
 function publicState() {return {...structuredClone(db), active, stopping, enabled};}
 async function git(directory, args, timeout = 15000) {
  if (injectedGit) return String(await injectedGit(directory, args, timeout)).trim();
  await mkdir(path.join(folder, 'empty-hooks'), {recursive: true});
  const controller = new AbortController(); controllers.add(controller);
  try {
   const result = await exec('git', ['-c', 'credential.helper=', '-c', 'core.hooksPath=' + path.join(folder, 'empty-hooks'), '-c', 'protocol.ext.allow=never', '-c', 'protocol.file.allow=never', '-c', 'submodule.recurse=false', '-C', directory, ...args], {windowsHide: true, shell: false, timeout, signal: controller.signal, maxBuffer: 2 * 1024**2, env: {...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never', GIT_OPTIONAL_LOCKS: '0'}});
   return result.stdout.trim();
  } catch (cause) {const e = error('git_error'); e.detail = String(cause.stderr || cause.message).slice(-3000); throw e;}
  finally {controllers.delete(controller);}
 }
 async function allowed(id) {
  const current = await candidates(), known = current.nodes.find(n => n.id === id);
  if (!known || !current.folders.includes(id)) throw error('source_unknown');
  const directory = await realpath(id), selected = current.directory ? await realpath(current.directory).catch(() => '') : '';
  if (directory === selected || directory === path.resolve(root)) throw error('source_unknown');
  const top = await realpath(await git(directory, ['rev-parse', '--show-toplevel']));
  if (top !== directory) throw error('source_unknown');
  const [remote, commit, branch, dirty] = await Promise.all([
   git(directory, ['config', '--get', 'remote.origin.url']), git(directory, ['rev-parse', 'HEAD']),
   git(directory, ['symbolic-ref', '--quiet', '--short', 'HEAD']), git(directory, ['status', '--porcelain', '--untracked-files=all'])
  ]);
  const repo = githubRepository(remote);
  if (!repo || !sha(commit) || !branch || /^(Comfy-Org\/ComfyUI|artoftomworks-debug\/artoftomworks-creator-hub)$/i.test(repo)) throw error('source_unknown');
  if (dirty) {const e = error('local_changes'); e.detail = dirty.slice(0, 6000); throw e;}
  return {id, name: known.name, directory, repo, commit, branch, checked: known};
 }
 async function plan({ids} = {}) {
  await init(); if (!enabled || active) throw error('update_busy');
  if (!Array.isArray(ids) || !ids.length || ids.length > 100 || new Set(ids).size !== ids.length || ids.some(id => typeof id !== 'string')) throw error('invalid_selection');
  const rows = [];
  for (const id of ids) {
   try {
    const item = await allowed(id);
    if (item.checked.status !== 'update' || item.checked.commit !== item.commit || item.checked.repo !== item.repo || item.checked.branch !== item.branch) throw error('source_changed');
    rows.push({...item, checked: undefined, before: item.commit, state: 'ready'});
   } catch (e) {rows.push({id, name: path.basename(id), state: 'skipped', reason: e.code || 'git_error', detail: e.detail || ''});}
  }
  const token = randomUUID(), value = {token, created: now(), rows};
  for (const [key, old] of plans) if (now() - old.created > 300000) plans.delete(key);
  if (plans.size >= 16) plans.delete(plans.keys().next().value);
  plans.set(token, value); return structuredClone(value);
 }
 async function idle() {if (await isBusy()) throw error('generation_busy');}
 async function backup(row, job) {
  const directory = path.join(folder, job.id), name = createHash('sha256').update(row.id).digest('hex').slice(0, 20);
  await mkdir(directory, {recursive: true});
  const partial = path.join(directory, name + '.bundle.partial'), target = path.join(directory, name + '.bundle');
  try {await git(row.directory, ['bundle', 'create', partial, 'HEAD'], 90000); await git(row.directory, ['bundle', 'verify', partial], 30000); await rename(partial, target);}
  finally {await unlink(partial).catch(() => {});}
  row.backup = target; row.backupHash = await fileHash(target);
  await atomicJSON(path.join(directory, name + '.json'), {id: row.id, directory: row.directory, repo: row.repo, branch: row.branch, before: row.before, backup: target, backupHash: row.backupHash, created: now()});
 }
 async function updateRow(row, job) {
  row.state = 'checking'; await save(); await idle();
  const fresh = await allowed(row.id);
  if (fresh.directory !== row.directory || fresh.commit !== row.before || fresh.branch !== row.branch || fresh.repo !== row.repo) throw error('source_changed');
  row.state = 'backing_up'; await save(); await backup(row, job);
  row.state = 'fetching'; await save();
  await git(row.directory, ['fetch', '--no-tags', '--no-recurse-submodules', 'https://github.com/' + row.repo + '.git', 'refs/heads/' + row.branch], 120000);
  const target = await git(row.directory, ['rev-parse', 'FETCH_HEAD^{commit}']);
  if (!sha(target)) throw error('source_changed');
  if (target === row.before) {row.state = 'current'; return;}
  try {await git(row.directory, ['merge-base', '--is-ancestor', row.before, target]);} catch {throw error('diverged');}
  const files = (await git(row.directory, ['diff', '--name-only', row.before, target, '--'])).split(/\r?\n/).filter(Boolean);
  row.dependencyFiles = [];
  for (const file of files.filter(installFile)) {
   let metadataOnly = false;
   if (/(^|\/)pyproject\.toml$/i.test(file)) {
    try {const [before, after] = await Promise.all([git(row.directory, ['show', row.before + ':' + file]), git(row.directory, ['show', target + ':' + file])]); metadataOnly = projectVersionOnly(before, after);} catch {}
   }
   if (!metadataOnly) row.dependencyFiles.push(file);
  }
  const raw = await git(row.directory, ['diff', '--raw', row.before, target, '--']);
  for (const line of raw.split(/\r?\n/)) if (/^:(?:160000 \d{6}|\d{6} 160000) /.test(line)) row.dependencyFiles.push('[submodule] ' + line.split('\t').slice(1).join('\t'));
  if (row.dependencyFiles.length) throw error('dependency_change');
  // Re-check immediately before touching the working tree.
  const last = await allowed(row.id); if (last.commit !== row.before || last.branch !== row.branch || last.repo !== row.repo) throw error('source_changed');
  await idle(); row.state = 'applying'; row.after = target; await save();
  await git(row.directory, ['merge', '--ff-only', '--no-edit', '--no-overwrite-ignore', target], 60000);
  if (await git(row.directory, ['rev-parse', 'HEAD']) !== target) throw error('verification_failed');
  row.state = 'updated'; row.finished = now(); db.needsRestart = true;
  await changed({...row, restored: false}).catch(() => {row.warning = 'cache_changed';});
 }
 async function start({token, confirmation} = {}) {
  await init(); if (!enabled || active) throw error('update_busy');
  const p = plans.get(token); if (!p || now() - p.created > 300000) throw error('plan_expired');
  if (confirmation !== 'UPDATE_SELECTED_NODES') throw error('confirmation_required');
  if (!p.rows.some(row => row.state === 'ready')) throw error('invalid_selection');
  active = true; stopping = false;
  try {await idle();} catch (e) {active = false; throw e;}
  const job = {id: randomUUID(), created: now(), state: 'queued', rows: structuredClone(p.rows)};
  for (const row of job.rows) if (row.state === 'ready') row.state = 'queued';
  db.jobs.unshift(job); db.jobs = db.jobs.slice(0, 10); plans.delete(token);
  try {await save();} catch (e) {active = false; job.state = 'failed'; throw e;}
  void (async () => {
   try {
    job.state = 'checking'; await save();
    for (const row of job.rows) {
     if (row.state !== 'queued') continue;
     if (closed || stopping) {row.state = 'skipped'; row.reason = 'stopped'; continue;}
     try {await updateRow(row, job);} catch (e) {row.state = ['local_changes', 'source_changed', 'source_unknown', 'dependency_change', 'diverged', 'generation_busy'].includes(e.code) ? 'skipped' : 'failed'; row.reason = e.code || 'git_error'; row.detail = e.detail || ''; if (e.code === 'generation_busy') stopping = true;}
     await save();
    }
    job.state = closed ? 'interrupted' : stopping ? 'stopped' : job.rows.some(r => r.state === 'failed' || r.state === 'skipped') ? 'partial' : 'complete';
    job.finished = now(); await save();
   } catch (e) {job.state = 'failed'; job.reason = 'journal_error'; await save().catch(() => {});}
   finally {active = false; stopping = false;}
  })();
  return publicState();
 }
 async function restore({jobId, id, confirmation} = {}) {
  await init(); if (!enabled || active) throw error('update_busy');
  if (confirmation !== 'RESTORE_NODE_UPDATE') throw error('confirmation_required');
  const job = db.jobs.find(j => j.id === jobId), row = job?.rows.find(r => r.id === id && ['updated', 'failed'].includes(r.state));
  if (!row || !sha(row.before) || !sha(row.after) || !row.backup || !inside(folder, path.resolve(row.backup))) throw error('backup_missing');
  active = true;
  try {
   await idle(); const fresh = await allowed(row.id);
   if (fresh.directory !== row.directory || ![row.before, row.after].includes(fresh.commit) || fresh.branch !== row.branch || fresh.repo !== row.repo) throw error('source_changed');
   if (await fileHash(row.backup) !== row.backupHash) throw error('backup_changed');
   if (fresh.commit === row.before) {row.state = 'restored'; row.reason = ''; row.detail = ''; row.restoredAt = now(); await changed({...row, restored: true}).catch(() => {}); await save(); return {...publicState(), active: false};}
   const additions = (await git(row.directory, ['diff', '--diff-filter=A', '--name-only', row.after, row.before, '--'])).split(/\r?\n/).filter(Boolean);
   for (const name of additions) {const file = path.resolve(row.directory, name); if (!inside(row.directory, file) || await stat(file).then(() => true).catch(() => false)) throw error('local_changes');}
   await git(row.directory, ['bundle', 'unbundle', row.backup], 60000);
   row.state = 'restoring'; await save();
   await git(row.directory, ['reset', '--hard', row.before], 60000);
   if (await git(row.directory, ['rev-parse', 'HEAD']) !== row.before) throw error('verification_failed');
   row.state = 'restored'; row.reason = ''; row.detail = ''; row.restoredAt = now(); db.needsRestart = true; await changed({...row, restored: true}).catch(() => {row.warning = 'cache_changed';}); await save();
   return {...publicState(), active: false};
  } catch (e) {if (row.state === 'restoring') {row.state = 'failed'; row.reason = e.code || 'git_error'; await save().catch(() => {});} throw e;}
  finally {active = false;}
 }
 async function restart() {
  await init(); if (active) throw error('update_busy'); active = true;
  try {
   await idle(); let s = await engine.status();
   if (s.mode !== 'managed' || !s.owned && !['stopped', 'error'].includes(s.state)) throw error('restart_manual');
   if (s.owned) {await engine.stop(); const stopDeadline = now() + 30000; do {await new Promise(r => setTimeout(r, 300)); s = await engine.status(); if (closed || now() > stopDeadline) throw error('restart_failed');} while (s.owned || s.state === 'stopping');}
   s = await engine.start(); const deadline = now() + 250000;
   while (s.state !== 'ready') {if (closed || ['error', 'stopped'].includes(s.state) || now() > deadline) throw error('restart_failed'); await new Promise(r => setTimeout(r, 700)); s = await engine.status();}
   db.needsRestart = false; await save(); return {...publicState(), active: false};
  } finally {active = false;}
 }
 return {plan, start, restore, restart, isApplying: () => active, async status() {await init(); return publicState();}, async stop() {await init(); stopping = true; return publicState();}, close() {closed = true; stopping = true; for (const c of controllers) c.abort();}};
}
