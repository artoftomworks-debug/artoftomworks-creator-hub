import {readFile, readdir, stat} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import {atomicJSON} from './storage.mjs';

const exec = promisify(execFile);
const COMFY = 'Comfy-Org/ComfyUI';
const HUB = 'artoftomworks-debug/artoftomworks-creator-hub';
const INTERVAL = 12 * 60 * 60 * 1000;
const RETRY = 30 * 60 * 1000;
const COOLDOWN = 3 * 60 * 1000;
const NODE_LIMIT = 20;
const exists = file => stat(file).then(() => true).catch(() => false);

export function githubRepository(remote) {
 const value = String(remote || '').trim();
 const match = /^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([a-z\d][a-z\d_.-]*\/[a-z\d][a-z\d_.-]*?)(?:\.git)?\/?$/i.exec(value);
 if (!match) return null;
 return /^(comfyanonymous|comfy-org)\/comfyui$/i.test(match[1]) ? COMFY : match[1];
}

export function version(value) {
 const match = /(?:^|[\s/_-])v?(\d+)\.(\d+)\.(\d+)(?:-([a-z\d.-]+))?/i.exec(String(value || ''));
 return match ? {numbers: match.slice(1, 4).map(Number), preview: match[4] || '', text: match.slice(1, 4).join('.') + (match[4] ? '-' + match[4] : '')} : null;
}

export function compareVersions(current, latest) {
 const a = version(current), b = version(latest);
 if (!a || !b) return null;
 for (let i = 0; i < 3; i++) if (a.numbers[i] !== b.numbers[i]) return Math.sign(a.numbers[i] - b.numbers[i]);
 if (a.preview && !b.preview) return -1;
 if (!a.preview && b.preview) return 1;
 return a.preview === b.preview ? 0 : null;
}

async function gitInfo(directory) {
 if (!await exists(path.join(directory, '.git'))) return null;
 const run = async args => (await exec('git', ['-C', directory, ...args], {windowsHide: true, timeout: 5000, maxBuffer: 16000, env: {...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0'}})).stdout.trim();
 try {
  const [remote, commit, branch] = await Promise.all([run(['config', '--get', 'remote.origin.url']), run(['rev-parse', 'HEAD']), run(['symbolic-ref', '--quiet', '--short', 'HEAD']).catch(() => '')]);
  return {repo: githubRepository(remote), commit: /^[a-f\d]{40}$/i.test(commit) ? commit : '', branch};
 } catch { return null; }
}

async function localVersion(directory) {
 try {
  const file = path.join(directory, 'comfyui_version.py');
  if ((await stat(file)).size > 64000) return null;
  return /__version__\s*=\s*['"]([^'"\r\n]+)['"]/.exec(await readFile(file, 'utf8'))?.[1] || null;
 } catch { return null; }
}

export function createUpdates({root, engine, roots = async () => [], hubVersion, fetchImpl = fetch, now = Date.now, enabled = true, readGit = gitInfo, readVersion = localVersion, maxNodes = NODE_LIMIT, paused = () => false} = {}) {
 const file = path.join(root, 'data', 'software-updates.json');
 let initialized, state = {schema: 'artoftomworks.software-updates', context: '', checkedAt: null, attemptedAt: null, nextCheckAt: 0, items: [], nodes: [], nodesCheckedAt: null, nodesTotal: 0, nodesDeferred: 0};
 let checking = null, kind = '', closed = false, controllers = new Set(), contextEpoch = 0;
 async function init() {
  if (!initialized) initialized = (async () => {try {const s = await stat(file); if (s.size > 512000) return; const saved = JSON.parse(await readFile(file, 'utf8')); if (saved.schema === state.schema && Array.isArray(saved.items) && Array.isArray(saved.nodes)) state = {...state, ...saved};} catch {}})();
  await initialized;
 }
 async function context() {
  const s = await engine.status(false);
  return {directory: s.mode === 'managed' ? s.config?.directory || '' : '', mode: s.mode || 'external'};
 }
 async function syncContext() {
  await init();
  const selected = await context(), key = JSON.stringify([selected.mode, selected.directory, hubVersion]);
  if (state.context !== key) {
   contextEpoch++;
   for (const c of controllers) c.abort();
   state = {...state, context: key, checkedAt: null, attemptedAt: null, nextCheckAt: 0, items: [], nodes: [], nodesCheckedAt: null, nodesTotal: 0, nodesDeferred: 0};
  }
  return selected;
 }
 const snapshot = () => ({...structuredClone(state), enabled, checking: !!checking, checkingKind: kind, mutationBusy: !!paused(), automaticIntervalHours: 12, nextManualAt: state.attemptedAt ? state.attemptedAt + COOLDOWN : 0});
 async function remote(url) {
  const controller = new AbortController(); controllers.add(controller);
  const timeout = setTimeout(() => controller.abort(), 9000);
  try {
   const response = await fetchImpl(url, {method: 'GET', redirect: 'error', signal: controller.signal, headers: {Accept: 'application/vnd.github+json', 'User-Agent': 'ArtofTomworks-CreatorHub-UpdateCheck', 'X-GitHub-Api-Version': '2022-11-28'}});
   if (!response.ok) throw Object.assign(Error(response.status === 403 || response.status === 429 ? 'rate_limit' : response.status === 404 ? 'no_release' : 'remote_error'), {code: response.status === 403 || response.status === 429 ? 'rate_limit' : response.status === 404 ? 'no_release' : 'remote_error'});
   if (Number(response.headers.get('content-length')) > 1024 * 1024) throw Error('response_too_large');
   const reader = response.body?.getReader();
   if (!reader) throw Error('empty_response');
   let size = 0; const chunks = [];
   try {while (true) {const {done, value} = await reader.read(); if (done) break; size += value.byteLength; if (size > 1024 * 1024) throw Error('response_too_large'); chunks.push(Buffer.from(value));}} finally {await reader.cancel().catch(() => {});}
   return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } finally {clearTimeout(timeout); controllers.delete(controller);}
 }
 function failed(item, error, previous = []) {
  const old = previous.find(p => p.id === item.id && p.repo === item.repo && p.current === item.current && p.commit === item.commit);
  return {...item, ...(old ? {latest: old.latest, notes: old.notes, url: old.url, publishedAt: old.publishedAt} : {}), status: 'unknown', stale: !!old?.latest, error: error.code || error.message || 'offline', checkedAt: now()};
 }
 async function release(item, previous) {
  try {
   const response = await remote('https://api.github.com/repos/' + item.repo + (item.id === 'hub' ? '/releases?per_page=20' : '/releases/latest'));
   // The Hub itself is Public Beta: published preview releases count here.
   // ComfyUI notifications deliberately stay on its stable release channel.
   const data = item.id === 'hub' ? (Array.isArray(response) ? response.find(r => !r.draft && version(r.tag_name)) : null) : response;
   if (!data) throw Object.assign(Error('no_release'), {code: 'no_release'});
   const latest = version(data.tag_name), comparison = compareVersions(item.current, data.tag_name);
   if (data.draft || data.prerelease && item.id !== 'hub' || !latest) throw Error('unknown_version');
   const prefix = 'https://github.com/' + item.repo + '/releases/tag/';
   return {...item, latest: latest.text, prerelease: !!data.prerelease, url: typeof data.html_url === 'string' && data.html_url.toLowerCase().startsWith(prefix.toLowerCase()) ? data.html_url : 'https://github.com/' + item.repo + '/releases', notes: String(data.body || '').slice(0, 12000), publishedAt: data.published_at || null, status: comparison === null ? 'unknown' : comparison < 0 ? 'update' : comparison > 0 ? 'ahead' : 'current', error: comparison === null ? 'unknown_version' : '', checkedAt: now()};
  } catch (error) {return failed(item, error, previous);}
 }
 async function nodeFolders(directory) {
  const found = new Set();
  const folders = new Set(directory ? [path.join(directory, 'custom_nodes')] : []);
  for (const r of await roots()) if (['nodepack', 'node_pack'].includes(r.kind)) folders.add(r.path);
  for (const folder of folders) {
   if (!folder) continue;
   if (await exists(path.join(folder, '.git'))) {found.add(path.resolve(folder)); continue;}
   for (const entry of await readdir(folder, {withFileTypes: true}).catch(() => [])) if (entry.isDirectory() && !entry.name.startsWith('.') && !['__pycache__', 'node_modules', 'web'].includes(entry.name) && !entry.name.endsWith('.disabled')) found.add(path.resolve(folder, entry.name));
  }
  return [...found].sort((a, b) => a.localeCompare(b)).slice(0, 300);
 }
 async function checkNodes(directory, epoch) {
  const folders = await nodeFolders(directory), previous = state.nodes;
  // A bounded batch must not leave the same later folders unchecked forever.
  const age = folder => {const old = previous.find(i => i.id === folder); return old?.status === 'deferred' || old?.deferredCheck ? 0 : old?.checkedAt || 0;};
  folders.sort((a, b) => age(a) - age(b) || a.localeCompare(b));
  const rows = []; let requests = 0, limited = false;
  // Sequential checks keep anonymous GitHub usage and disk/process load bounded.
  for (const folder of folders) {
   if (closed || epoch !== contextEpoch) break;
   const item = {id: folder, name: path.basename(folder), status: 'unknown', repo: null, current: null};
   if (requests >= maxNodes || limited) {const old=previous.find(i=>i.id===folder);rows.push(old&&['update','current','ahead','review'].includes(old.status)?{...old,stale:true,deferredCheck:true}:{...item,status:'deferred',deferredCheck:true});continue;}
   const git = await readGit(folder);
   if (!git?.repo || !git.commit || !git.branch || !/^[a-z\d][a-z\d_.-]*\/[a-z\d][a-z\d_.-]*$/i.test(git.repo) || !/^[a-f\d]{40}$/i.test(git.commit)) {rows.push({...item, error: 'source_unknown'}); continue;}
   Object.assign(item, {repo: git.repo, commit: git.commit, current: git.commit.slice(0, 8), branch: git.branch}); requests++;
   try {
    const url = 'https://api.github.com/repos/' + git.repo + '/compare/' + git.commit + '...' + encodeURIComponent(git.branch);
    const data = await remote(url);
    if (!['identical', 'ahead', 'behind', 'diverged'].includes(data.status) || !Number.isFinite(data.ahead_by) || !Number.isFinite(data.behind_by)) throw Error('invalid_comparison');
    rows.push({...item, status: data.status === 'identical' ? 'current' : data.status === 'ahead' && data.ahead_by > 0 && data.behind_by === 0 ? 'update' : data.status === 'behind' ? 'ahead' : 'review', ahead: data.ahead_by, behind: data.behind_by, url: 'https://github.com/' + git.repo + '/compare/' + git.commit + '...' + encodeURIComponent(git.branch), checkedAt: now()});
   } catch (error) {rows.push(failed(item, error, previous)); if (error.code === 'rate_limit') limited = true;}
  }
  return {nodes: rows, nodesTotal: folders.length, nodesDeferred: rows.filter(r => r.status === 'deferred' || r.deferredCheck).length, nodesCheckedAt: now()};
 }
 async function run({nodes = false, force = false} = {}) {
  if (closed) return snapshot();
  const selected = await syncContext();
  if (!enabled) return snapshot();
  if (paused()) return {...snapshot(), mutationBusy: true};
  if (checking) {await checking; return snapshot();}
  if (!nodes && !force && state.nextCheckAt > now()) return snapshot();
  if (!nodes && force && state.attemptedAt && now() - state.attemptedAt < COOLDOWN) return {...snapshot(), cooldown: true};
  if (nodes && state.nodesCheckedAt && now() - state.nodesCheckedAt < COOLDOWN) return {...snapshot(), cooldown: true};
  const epoch = contextEpoch; kind = nodes ? 'nodes' : 'software';
  checking = (async () => {
   if (nodes) {
    const result = await checkNodes(selected.directory, epoch);
    if (closed || epoch !== contextEpoch) return;
    state = {...state, ...result};
   } else {
    state.attemptedAt = now();
    const git = selected.directory ? await readGit(selected.directory) : null;
    const current = selected.directory ? await readVersion(selected.directory) : null;
    const comfy = {id: 'comfyui', name: 'ComfyUI', repo: COMFY, current, commit: git?.commit || null};
    const results = await Promise.all([
     current && (!git || git.repo?.toLowerCase() === COMFY.toLowerCase()) ? release(comfy, state.items) : Promise.resolve({...comfy, status: 'unknown', error: git?.repo ? 'custom_source' : 'local_version_unknown', url: 'https://github.com/' + COMFY + '/releases'}),
     release({id: 'hub', name: 'Creator Hub', repo: HUB, current: hubVersion}, state.items)
    ]);
    if (closed || epoch !== contextEpoch) return;
    state = {...state, items: results, checkedAt: now(), nextCheckAt: now() + (results.some(r => r.error && r.error !== 'no_release') ? RETRY : INTERVAL)};
   }
   try {await atomicJSON(file, state);} catch {state.persistenceError = true;}
  })().finally(() => {checking = null; kind = '';});
  await checking;
  return snapshot();
 }
 return {
  async status() {await syncContext(); if (!checking && !closed && enabled && !paused() && state.nextCheckAt <= now()) void run().catch(() => {}); return snapshot();},
  async candidates() {const selected = await syncContext(); if (checking && kind === 'nodes') throw Object.assign(Error('check_busy'), {code: 'check_busy'}); return {...selected, folders: await nodeFolders(selected.directory), nodes: structuredClone(state.nodes)};},
  async changedNode(row) {await syncContext(); const item = state.nodes.find(i => i.id === row.id); if (item) Object.assign(item, {status: row.restored ? 'unknown' : 'current', current: (row.restored ? row.before : row.after).slice(0, 8), commit: row.restored ? row.before : row.after, ahead: row.restored ? undefined : 0, error: row.restored ? 'check_again' : '', checkedAt: now()}); state.nodesCheckedAt = null; await atomicJSON(file, state);},
  check: run,
  close() {closed = true; for (const c of controllers) c.abort();}
 };
}
