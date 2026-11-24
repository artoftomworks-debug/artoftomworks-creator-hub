import {getLanguage, getLocale} from './i18n-ui.mjs';
import {updateText} from './updates-i18n.mjs';
import {nodeUpdateText} from './node-updates-i18n.mjs';
import {createNodeUpdatesUI} from './node-updates-ui.mjs';

export function createUpdatesUI({request}) {
 const el = (tag, cls, text) => {const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e;};
 const t = key => nodeUpdateText(getLanguage(), key) ?? updateText(getLanguage(), key);
 let state = null, pending = false, stopped = false, timer, messageKey = '', opener, renderedKey = '';
 const button = el('button', 'softwareUpdatesBadge'); button.id = 'softwareUpdates'; button.type = 'button'; button.dataset.i18nIgnore = '';
 document.querySelector('body>header nav')?.prepend(button);
 const dialog = el('dialog', 'softwareUpdatesDialog'); dialog.id = 'softwareUpdatesDialog'; dialog.dataset.i18nIgnore = ''; dialog.setAttribute('aria-labelledby', 'softwareUpdatesTitle');
 const heading = el('div', 'softwareUpdatesHeading'), title = el('h2'); title.id = 'softwareUpdatesTitle'; const close = el('button'); close.type = 'button'; heading.append(title, close);
 const automatic = el('p', 'muted'), notice = el('p', 'softwareUpdatesNotice'), actions = el('div', 'inline'), check = el('button', 'primary'), checkNodes = el('button'); check.type = checkNodes.type = 'button'; actions.append(check, checkNodes);
 const status = el('p', 'muted'); status.setAttribute('role', 'status'); const items = el('div'), nodeHeading = el('h3'), nodeNotice = el('p', 'muted'), nodeList = el('div'), deferred = el('p', 'muted');
 dialog.append(heading, automatic, notice, actions, status, items, nodeHeading, nodeNotice, deferred, nodeList); document.body.append(dialog);
 const nodesUI=createNodeUpdatesUI({host:nodeList,request,t,onChanged:()=>void poll()});
 const stateLabel = item => ({update: 'update', current: 'upToDate', ahead: 'ahead', review: 'review', deferred: 'deferred'})[item.status] || 'unknown';
 const errorLabel = code => ({source_unknown: 'sourceUnknown', custom_source: 'sourceUnknown', local_version_unknown: 'versionUnknown', unknown_version: 'versionUnknown', no_release: 'noRelease', rate_limit: 'rateLimit'})[code] || 'offline';
 function link(url) {
  try {const u = new URL(url); if (u.protocol !== 'https:' || u.hostname !== 'github.com' || u.username || u.password) return null; const a = el('a', '', t('source')); a.href = u.href; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a;} catch {return null;}
 }
 function row(item, compact = false) {
  const card = el('section', 'softwareUpdateCard'); card.dataset.status = item.status; card.dataset.updateId = item.id;
  const h = el('div', 'softwareUpdateCardHeading'); h.append(el('strong', '', item.name), el('span', 'softwareUpdateState', t(stateLabel(item)))); card.append(h);
  const versions = el('p', 'muted'); versions.append(el('span', '', t('current') + ': ' + (item.current || '—')), document.createTextNode(' · '), el('span', '', t('latest') + ': ' + (item.latest || (Number.isFinite(item.ahead) ? '+' + item.ahead : '—')) + (item.prerelease ? ' · Public Beta' : ''))); card.append(versions);
  if (item.error) card.append(el('p', 'softwareUpdateError', t(errorLabel(item.error))));
  const a = link(item.url || (item.repo ? 'https://github.com/' + item.repo : '')); if (a) card.append(a);
  if (!compact && item.notes) {const details = el('details'); details.append(el('summary', '', t('notes')), el('pre', 'softwareReleaseNotes', item.notes)); card.append(details);}
  return card;
 }
 function render() {
  const total = [...(state?.items || []), ...(state?.nodes || [])].filter(i => i.status === 'update').length;
  button.textContent = t('title') + (total ? ' · ' + total : ''); button.classList.toggle('hasUpdates', total > 0); button.setAttribute('aria-label', t('title') + (total ? ': ' + total : '')); button.title = t('details');
  title.textContent = t('title'); close.textContent = t('close'); automatic.textContent = t('automatic'); notice.textContent = t('planNotice'); check.textContent = t('check'); checkNodes.textContent = t('checkNodes');
  check.disabled = checkNodes.disabled = pending || !!state?.checking || state?.enabled === false || !!state?.mutationBusy;
  const checked = state?.checkedAt ? new Date(state.checkedAt).toLocaleString(getLocale()) : t('never');
  status.textContent = messageKey ? t(messageKey) : (pending || state?.checking ? t('checking') : t('lastCheck') + ': ' + checked);
  // Re-render only while open: unrelated generation controls retain their focus.
  if (!dialog.open) return;
  const key = JSON.stringify([getLanguage(), state?.items, state?.nodes, state?.nodesDeferred, state?.nodesTotal]);
  if (key === renderedKey) return;
  renderedKey = key;
  const scroll = dialog.scrollTop, expanded = new Set([...dialog.querySelectorAll('.softwareUpdateCard')].filter(card => card.querySelector('details')?.open).map(card => card.dataset.updateId));
  items.replaceChildren(...(state?.items?.length ? state.items.map(i => row(i)) : [el('p', 'muted', t('pending'))]));
  nodeHeading.textContent = t('nodes') + (state?.nodesTotal ? ' · ' + state.nodesTotal : ''); nodeNotice.textContent = t('nodeNotice'); deferred.hidden = !state?.nodesDeferred; deferred.textContent = t('deferred') + ': ' + (state?.nodesDeferred || 0);
  nodesUI.setState(state||{});
  for (const card of dialog.querySelectorAll('.softwareUpdateCard')) if (expanded.has(card.dataset.updateId) && card.querySelector('details')) card.querySelector('details').open = true;
  dialog.scrollTop = scroll;
 }
 function schedule(delay = 60000) {clearTimeout(timer); if (!stopped) timer = setTimeout(() => void poll(), delay);}
 async function poll() {
  if (stopped) return;
  try {state = await request('updates/status'); messageKey = ''; render(); schedule(state.enabled !== false && (state.checking || !state.items?.length) ? 1500 : document.hidden ? 300000 : 60000);}
  catch (error) {messageKey = /404|Not found/i.test(error.message) ? 'restart' : 'offline'; render(); schedule(60000);}
 }
 async function run(nodes) {
  if (pending || state?.checking || state?.mutationBusy) return;
  pending = true; messageKey = ''; render();
  try {state = await request('updates/check', {nodes, force: true}); messageKey = state.cooldown ? 'cooldown' : '';}
  catch (error) {messageKey = /404|Not found/i.test(error.message) ? 'restart' : 'offline';}
  finally {pending = false; render(); schedule(state?.checking ? 1500 : 60000);}
 }
 button.onclick = () => {opener = document.activeElement; dialog.showModal(); render();}; close.onclick = () => dialog.close();
 dialog.addEventListener('click', event => {if (event.target !== dialog) return; const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();});
 dialog.addEventListener('close', () => opener?.focus());
 check.onclick = () => void run(false); checkNodes.onclick = () => void run(true);
 const onLanguage = () => {render();nodesUI.languageChanged();}; window.addEventListener('creator-hub-language', onLanguage);
 render();
 return {init() {nodesUI.init();void poll();}, destroy() {nodesUI.destroy();stopped = true; clearTimeout(timer); window.removeEventListener('creator-hub-language', onLanguage); button.remove(); dialog.remove();}};
}
