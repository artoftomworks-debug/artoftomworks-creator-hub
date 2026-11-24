export function createNodeUpdatesUI({host, request, t, onChanged = () => {}}) {
 const el = (tag, cls, text) => {const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e;};
 let source = [], selection = new Map(), page = 0, pending = false, plan = null, restoreTarget = null, jobs = null, timer, closed = false, message = '', painted = '', lastJobKey = '', busy = false, selectedJob = '';
 const tools = el('div', 'nodeUpdateTools'), search = el('input'), filterLabel = el('label', 'check'), filter = el('input'), filterText = el('span');
 search.type = 'search'; search.id = 'nodeUpdateSearch'; filter.type = 'checkbox'; filter.checked = true; filterLabel.append(filter, filterText); tools.append(search, filterLabel);
 const bar = el('div', 'inline'), all = el('button'), clear = el('button'), apply = el('button', 'primary'), count = el('span', 'muted'); for (const b of [all, clear, apply]) b.type = 'button'; apply.id = 'nodeUpdateSelected'; bar.append(all, clear, apply, count);
 const list = el('div', 'nodeUpdateList'), pager = el('div', 'inline nodeUpdatePager'), previous = el('button'), next = el('button'), position = el('span', 'muted'); previous.type = next.type = 'button'; pager.append(previous, position, next); bar.classList.add('nodeUpdateToolbar');
 const feedback = el('p', 'softwareUpdateError'); feedback.setAttribute('role', 'status');
 const review = el('section', 'nodeUpdateReview'), reviewInfo = el('p'), reviewRows = el('div', 'nodeUpdateReviewRows'), confirm = el('button', 'primary'), cancel = el('button'); review.hidden = true; confirm.type = cancel.type = 'button'; review.append(reviewInfo, confirm, cancel, reviewRows);
 const progress = el('section', 'nodeUpdateProgress'), progressTitle = el('h3'), jobSelect = el('select'), progressSummary = el('p'), stop = el('button'), copy = el('button'), resultRows = el('div'), restartInfo = el('p'), restart = el('button'); stop.type = copy.type = restart.type = 'button'; progress.append(progressTitle, jobSelect, progressSummary, stop, copy, resultRows, restartInfo, restart);
 const overview = el('div', 'nodeUpdateOverview'), overviewText = el('strong'), overviewDetails = el('button'); overviewText.setAttribute('role','status'); overviewDetails.type='button'; overview.append(overviewText,overviewDetails); overviewDetails.onclick=()=>progress.scrollIntoView({block:'start',behavior:'smooth'});
 const controls = el('div', 'nodeUpdateControls'); controls.append(overview, tools, bar); host.append(controls, feedback, list, pager, review, progress);
 const reasonKey = reason => ({dependency_change: 'dependencyChange', local_changes: 'localChanges', source_changed: 'reviewChange', diverged: 'reviewChange', backup_changed: 'backupProblem', backup_missing: 'backupProblem', source_unknown: 'sourceUnknown', generation_busy: 'busy', update_busy: 'busy', check_busy: 'busy', plan_expired: 'selectAgain', invalid_selection: 'selectAgain', restart_manual: 'restartManual', stopped: 'stopped', interrupted: 'interrupted'})[reason] || 'operationFailed';
 const reasonText = reason => t(reasonKey(reason));
 const eligible = item => item.status === 'update' && !!item.commit && !!item.repo;
 const filtered = () => {const q = search.value.toLocaleLowerCase(); return source.filter(n => (!filter.checked || n.status === 'update') && (n.name + ' ' + (n.repo || '')).toLocaleLowerCase().includes(q)).sort((a, b) => Number(b.status === 'update') - Number(a.status === 'update') || a.name.localeCompare(b.name));};
 const label = state => t(({current: 'upToDate', update: 'update', unknown: 'unknown', deferred: 'deferred', ahead: 'ahead', review: 'review'})[state] || state);
 function emit(value) {if (busy === value) return; busy = value; window.dispatchEvent(new CustomEvent('creator-hub-node-update', {detail: {active: value}}));}
 function sourceLink(item) {if (!item.repo || !/^[a-z\d][a-z\d_.-]*\/[a-z\d][a-z\d_.-]*$/i.test(item.repo)) return null; const a = el('a', '', t('source')); a.href = 'https://github.com/' + item.repo; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a;}
 function renderList() {
  for (const [id, commit] of selection) if (!source.some(n => n.id === id && eligible(n) && n.commit === commit)) selection.delete(id);
  const values = filtered(), pages = Math.max(1, Math.ceil(values.length / 12)); page = Math.min(page, pages - 1);
  search.placeholder = t('search'); search.setAttribute('aria-label', t('search')); filterText.textContent = t('onlyUpdates'); all.textContent = t('selectAll'); clear.textContent = t('clearSelection'); apply.textContent = t('updateSelected'); count.textContent = t('selected') + ': ' + selection.size + ' · ' + values.length;
  all.disabled = clear.disabled = pending || busy; apply.disabled = pending || busy || !selection.size || jobs?.enabled === false;
  previous.textContent = t('previous'); next.textContent = t('next'); previous.disabled = page === 0; next.disabled = page >= pages - 1; position.textContent = (page + 1) + ' / ' + pages; pager.hidden = pages <= 1;
  const fingerprint = JSON.stringify([values, [...selection], page, pending, busy, t('updateSelected')]);
  if (fingerprint === painted) return; painted = fingerprint;
  const focusId = document.activeElement?.closest('.nodeUpdateRow')?.dataset.nodeId;
  const rows = values.slice(page * 12, page * 12 + 12).map(item => {
   const row = el('div', 'nodeUpdateRow'); row.dataset.nodeId = item.id; row.dataset.status = item.status;
   const choose = el('input'); choose.type = 'checkbox'; choose.checked = selection.has(item.id); choose.disabled = pending || busy || !eligible(item); choose.setAttribute('aria-label', item.name); choose.onchange = () => {if (choose.checked) selection.set(item.id, item.commit); else selection.delete(item.id); plan = restoreTarget = null; review.hidden = true; renderList();};
   const content = el('div', 'nodeUpdateRowText'); content.append(el('strong', '', item.name));
   const summary = item.status === 'update' ? t('newChanges').replace('{n}', item.ahead || 0) : label(item.status);
   content.append(el('small', 'muted', summary + (item.current ? ' · ' + t('current') + ': ' + item.current : '')));
   if(item.stale&&item.checkedAt)content.append(el('small','muted',t('lastCheck')+': '+new Date(item.checkedAt).toLocaleString()));
   if (item.error) content.append(el('small', 'softwareUpdateError', item.error === 'source_unknown' ? t('sourceUnknown') : item.error === 'check_again' ? t('selectAgain') : t('unknown')));
   const link = sourceLink(item); row.append(choose, content); if (link) row.append(link); return row;
  });
  list.replaceChildren(...(rows.length ? rows : [el('p', 'muted', source.length ? t('noMatches') : t('manual'))]));
  if (focusId) [...list.children].find(row => row.dataset.nodeId === focusId)?.querySelector('input')?.focus();
 }
 function renderReview() {
  review.hidden = !plan && !restoreTarget;
  cancel.textContent = t('cancel'); confirm.textContent = restoreTarget ? t('restoreNode') : t('confirmUpdate');
  confirm.disabled = pending || busy || !!plan && !plan.rows.some(r => r.state === 'ready'); cancel.disabled = pending;
  if (restoreTarget) {reviewInfo.textContent = t('restoreNode') + ': ' + restoreTarget.row.name; reviewRows.replaceChildren(); return;}
  if (!plan) return;
  reviewInfo.textContent = t('planNotice');
  reviewRows.replaceChildren(...plan.rows.map(row => {const entry=el('div');entry.append(el('p', row.state === 'ready' ? '' : 'softwareUpdateError', row.name + ' · ' + label(row.state) + (row.reason ? ' · ' + reasonText(row.reason) : '')));if(row.detail){const detail=el('details');detail.append(el('summary','',t('details')),el('pre','softwareReleaseNotes',row.detail));entry.append(detail);}return entry;}));
 }
 function renderJobs() {
  const job = jobs?.jobs?.find(j => j.id === selectedJob) || jobs?.jobs?.[0]; progress.hidden = !job && !jobs?.needsRestart && !jobs?.active;
  overview.hidden=!job;overviewDetails.textContent=t('details');
  if(job){const summary=jobs?.active?label(job.state):t('resultCounts').replace('{updated}',job.rows.filter(r=>r.state==='updated'||r.state==='restored').length).replace('{skipped}',job.rows.filter(r=>r.state==='skipped').length).replace('{failed}',job.rows.filter(r=>r.state==='failed').length);overviewText.textContent=summary;overview.dataset.state=jobs?.active?'active':job.rows.some(r=>r.state==='failed'||r.state==='skipped')?'attention':'complete';}
  jobSelect.hidden = !jobs?.jobs?.length; jobSelect.disabled = busy || pending; jobSelect.setAttribute('aria-label',t('jobs'));
  jobSelect.replaceChildren(...(jobs?.jobs||[]).map(j=>new Option(new Date(j.created||Date.now()).toLocaleString()+' · '+label(j.state),j.id))); if(job) jobSelect.value=job.id;
  progressTitle.textContent = t('jobs'); stop.textContent = t('stopUpdates'); copy.textContent = t('copyLog'); restart.textContent = t('restartEngine'); restartInfo.textContent = t('restartNeeded');
  stop.hidden = !jobs?.active; stop.disabled = pending || !!jobs?.stopping; restart.hidden = restartInfo.hidden = !jobs?.needsRestart; restart.disabled = pending || busy; copy.hidden = !job;
  if (!job) {progressSummary.textContent = jobs?.active ? t('checking') : ''; resultRows.replaceChildren(); return;}
  const done = job.rows.filter(r => ['updated', 'restored', 'current', 'skipped', 'failed'].includes(r.state)).length;
  progressSummary.textContent = label(job.state) + ' · ' + done + ' / ' + job.rows.length;
  const key = JSON.stringify([job, busy, t('jobs')]); if (key === lastJobKey) return; lastJobKey = key;
  resultRows.replaceChildren(...job.rows.map(row => {
   const result = el('div', 'nodeUpdateResult'); result.dataset.state = row.state;
   result.append(el('strong', '', row.name), el('span', '', label(row.state)));
   if (row.reason) result.append(el('p', 'softwareUpdateError', reasonText(row.reason)));
   if (row.dependencyFiles?.length || row.detail) {const details = el('details'); details.append(el('summary', '', t('details')), el('pre', 'softwareReleaseNotes', (row.dependencyFiles || []).join('\n') + (row.detail ? '\n' + row.detail : ''))); result.append(details);}
   if (row.backup && row.after && ['updated', 'failed'].includes(row.state)) {const restore = el('button', '', t('restoreNode')); restore.type = 'button'; restore.disabled = pending || busy; restore.onclick = () => {restoreTarget = {jobId: job.id, row}; plan = null; renderReview(); review.scrollIntoView({block: 'nearest'});}; result.append(restore);}
   return result;
  }));
 }
 function render() {feedback.textContent = message; renderList(); renderReview(); renderJobs();}
 const schedule = delay => {clearTimeout(timer); if (!closed) timer = setTimeout(() => void poll(), delay);};
 async function poll() {
  if (closed) return;
  try {const wasActive = !!jobs?.active; jobs = await request('updates/install/status'); emit(!!jobs.active); render(); if (wasActive && !jobs.active) onChanged(); schedule(jobs.active ? 1200 : 60000);}
  catch {schedule(60000);}
 }
 async function action(fn) {
  if (pending) return; pending = true; message = ''; render();
  try {await fn();} catch (e) {message = reasonText(e.message);}
  finally {pending = false; emit(!!jobs?.active); render(); schedule(jobs?.active ? 800 : 60000);}
 }
 search.oninput = filter.onchange = () => {page = 0; renderList();};
 all.onclick = () => {for (const item of filtered().filter(eligible).slice(0, 100)) selection.set(item.id, item.commit); renderList();};
 clear.onclick = () => {selection.clear(); plan = restoreTarget = null; review.hidden = true; renderList();};
 previous.onclick = () => {page--; renderList();}; next.onclick = () => {page++; renderList();};
 apply.onclick = () => void action(async () => {plan = await request('updates/install/plan', {ids: [...selection.keys()]}); restoreTarget = null; renderReview(); review.scrollIntoView({block: 'nearest'});});
 cancel.onclick = () => {plan = restoreTarget = null; renderReview();};
 confirm.onclick = () => void action(async () => {
  emit(true);
  if (restoreTarget) jobs = await request('updates/install/restore', {jobId: restoreTarget.jobId, id: restoreTarget.row.id, confirmation: 'RESTORE_NODE_UPDATE'});
  else if (plan) {jobs = await request('updates/install/start', {token: plan.token, confirmation: 'UPDATE_SELECTED_NODES'});selectedJob=jobs.jobs?.[0]?.id||'';}
  plan = restoreTarget = null; selection.clear(); onChanged();
 });
 stop.onclick = () => void action(async () => {jobs = await request('updates/install/stop', {});});
 jobSelect.onchange=()=>{selectedJob=jobSelect.value;lastJobKey='';renderJobs();};
 restart.onclick = () => {if (window.confirm(t('restartConfirm'))) void action(async () => {emit(true);jobs = await request('updates/install/restart', {});});};
 copy.onclick = () => void action(async () => {await navigator.clipboard.writeText(JSON.stringify(jobs, null, 2)); message = t('copied');});
 render();
 return {setState(state) {source = state.nodes || []; render();}, languageChanged: render, init() {void poll();}, destroy() {closed = true; clearTimeout(timer); emit(false);}};
}
