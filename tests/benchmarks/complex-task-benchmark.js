const $ = (id) => document.getElementById(id);
const taskIds = ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9', 't10'];
const state = {
  startedAt: 0,
  label: '',
  model: '',
  otp: '',
  selectedTicket: '',
  frameCode: '',
  markedItem: '',
  quoteId: '',
  tasks: Object.fromEntries(taskIds.map((t) => [t, false])),
  events: [],
};
const unlock = (...ids) => ids.forEach((id) => $(id).classList.remove('locked'));
const log = (event, data = {}) => state.events.push({ ts: Date.now(), event, ...data });
const status = (id, msg, ok = false) => {
  const el = $(id);
  el.textContent = msg;
  el.className = `status ${ok ? 'ok' : 'bad'}`;
};
const markTask = (id, ok, detail) => {
  if (ok && !state.tasks[id]) log('task_complete', { id, detail });
  state.tasks[id] = !!ok;
  const li = [...document.querySelectorAll('#taskChecklist li')].find((node) => node.dataset.task === id);
  if (li) li.classList.toggle('done', !!ok);
  updateSummary();
};
const updateSummary = () => {
  const done = Object.values(state.tasks).filter(Boolean).length;
  $('progress').textContent = `${done} / 10 tasks complete`;
  $('proofCode').textContent = done === 10 ? `Proof: ${makeProof()}` : 'Proof: pending';
  renderExport();
};
const makeProof = () => {
  const seed = [state.label, state.model, state.quoteId, state.selectedTicket, state.frameCode, state.markedItem].join(
    '|',
  );
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = (h ^ seed.charCodeAt(i)) * 16777619;
  return `PX-${Math.abs(h >>> 0)
    .toString(16)
    .padStart(8, '0')
    .toUpperCase()}`;
};
const renderExport = () => {
  const done = Object.values(state.tasks).filter(Boolean).length;
  $('benchmarkJson').value = JSON.stringify(
    {
      meta: { label: state.label, model: state.model, startedAt: state.startedAt, exportedAt: Date.now() },
      result: { complete: done === 10, completed: done, total: 10, proof: done === 10 ? makeProof() : null },
      tasks: state.tasks,
      details: {
        quoteId: state.quoteId,
        pinnedTicket: state.selectedTicket,
        frameCode: state.frameCode,
        markedItem: state.markedItem,
      },
      eventCount: state.events.length,
      events: state.events.slice(-120),
    },
    null,
    2,
  );
};
$('startRun').addEventListener('click', () => {
  state.label = $('runLabel').value.trim();
  state.model = $('modelName').value.trim();
  if (!state.label || !state.model) return alert('Provide run label and model name.');
  state.startedAt = Date.now();
  log('run_started', { label: state.label, model: state.model });
  unlock('authCard');
  updateSummary();
});
$('requestOtp').addEventListener('click', () => {
  const ok = $('username').value.trim() === 'ops_lead' && $('password').value === 'S3cur3#Parchi';
  if (!ok) return status('authStatus', 'Credentials rejected.');
  state.otp = String(100000 + (((Date.now() / 1000) | 0) % 899999));
  $('otpInbox').innerHTML =
    `<div>old code: 184202 (expired)</div><div>ticket: ${state.otp} (valid)</div><div>hint: use latest ticket</div>`;
  log('otp_issued');
  status('authStatus', 'OTP issued.');
});
$('verifyOtp').addEventListener('click', () => {
  const ok = $('otpInput').value.trim() === state.otp;
  status('authStatus', ok ? 'Auth complete.' : 'OTP invalid.', ok);
  markTask('t1', ok, 'auth_otp');
  if (ok)
    unlock(
      'formCard',
      'tableCard',
      'kanbanCard',
      'releaseCard',
      'shadowCard',
      'frameCard',
      'scrollCard',
      'richTextCard',
      'assetCard',
    );
});
$('plan').addEventListener('change', () =>
  $('enterpriseFields').classList.toggle('hidden', $('plan').value !== 'enterprise'),
);
$('submitQuote').addEventListener('click', () => {
  const ok =
    $('region').value === 'emea' &&
    $('plan').value === 'enterprise' &&
    Number($('seatCount').value) === 120 &&
    $('vatId').value.trim().startsWith('EMEA-') &&
    $('contactEmail').value.trim().endsWith('@example.org') &&
    $('addonAudit').checked &&
    $('addonAlerts').checked;
  state.quoteId = ok ? 'Q-7742' : '';
  status('quoteStatus', ok ? 'Quote accepted: Q-7742' : 'Quote invalid. Check hidden enterprise requirements.', ok);
  markTask('t2', ok, state.quoteId);
});
const rows = [
  ['INC-1309', 'medium', 'maya', 13],
  ['INC-2210', 'high', 'liam', 9],
  ['INC-7421', 'high', 'olivia', 7],
  ['INC-8890', 'high', 'elias', 16],
  ['INC-5003', 'medium', 'leo', 22],
  ['INC-7740', 'high', 'li', 8],
];
const renderRows = () => {
  const severity = $('severityFilter').value;
  const ownerPart = $('ownerFilter').value.trim().toLowerCase();
  const sortBy = $('sortBy').value;
  let data = rows.filter((r) => (severity === 'all' ? true : r[1] === severity) && r[2].includes(ownerPart));
  if (sortBy === 'slaAsc') data = data.sort((a, b) => a[3] - b[3]);
  $('incidentRows').innerHTML = data
    .map((r) => `<tr data-ticket="${r[0]}"><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`)
    .join('');
  [...$('incidentRows').querySelectorAll('tr')].forEach(
    (tr) =>
      (tr.onclick = () => {
        [...$('incidentRows').querySelectorAll('tr')].forEach((x) => x.classList.remove('selected'));
        tr.classList.add('selected');
        state.selectedTicket = tr.dataset.ticket || '';
      }),
  );
};
$('applyTable').addEventListener('click', renderRows);
$('pinTicket').addEventListener('click', () => {
  const ok =
    state.selectedTicket === 'INC-7421' &&
    $('severityFilter').value === 'high' &&
    $('ownerFilter').value.trim().toLowerCase() === 'li' &&
    $('sortBy').value === 'slaAsc';
  status('tableStatus', ok ? 'Pinned INC-7421.' : 'Wrong ticket/filter/sort combo.', ok);
  markTask('t3', ok, state.selectedTicket);
});
renderRows();
let dragEl = null;
[...document.querySelectorAll('.lane')].forEach((lane) => {
  lane.addEventListener('dragstart', (e) => {
    dragEl = e.target.closest('li');
  });
  lane.addEventListener('dragover', (e) => e.preventDefault());
  lane.addEventListener('drop', (e) => {
    e.preventDefault();
    if (dragEl) lane.appendChild(dragEl);
  });
});
$('validateKanban').addEventListener('click', () => {
  const done = [...document.querySelectorAll('[data-lane="done"] li')].map((li) => li.textContent.trim()).join('|');
  const ok = done === 'Audit Logs|Rate Limits|Retry Policy';
  status('kanbanStatus', ok ? 'Kanban order valid.' : `Done order mismatch: ${done}`, ok);
  markTask('t4', ok, done);
});
const dialog = $('releaseDialog');
$('openRelease').addEventListener('click', () => dialog.showModal());
$('modalClose').addEventListener('click', () => dialog.close());
$('modalNext').addEventListener('click', () => {
  if (!($('rc1').checked && $('rc2').checked)) return status('releaseStatus', 'Both checks required.');
  $('modalStep1').classList.add('hidden');
  $('modalStep2').classList.remove('hidden');
});
$('modalConfirm').addEventListener('click', () => {
  const ok = $('confirmPhrase').value.trim() === 'ship-it-now';
  status('releaseStatus', ok ? 'Release confirmed.' : 'Phrase mismatch.', ok);
  markTask('t5', ok, 'release_modal');
  if (ok) dialog.close();
});
class SecureToggle extends HTMLElement {
  connectedCallback() {
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>div{display:grid;gap:6px}input,select,button{padding:6px;border-radius:6px;border:1px solid #334155;background:#0f172a;color:#e2e8f0}button{background:#22c55e;color:#052e16;border:none;font-weight:700}</style><div><select id="m"><option value="audit">audit</option><option value="strict">strict</option></select><input id="k" placeholder="policy key"/><button id="a">Apply</button></div>`;
    root.getElementById('a').onclick = () =>
      this.dispatchEvent(
        new CustomEvent('secure-apply', {
          detail: { mode: root.getElementById('m').value, key: root.getElementById('k').value.trim() },
        }),
      );
  }
}
customElements.define('secure-toggle', SecureToggle);
$('secureToggle').addEventListener('secure-apply', (e) => {
  const ok = e.detail.mode === 'strict' && e.detail.key === 'agent-9001';
  status('shadowStatus', ok ? 'Secure mode applied.' : 'Need strict mode + agent-9001.', ok);
  markTask('t6', ok, e.detail.mode);
});
window.addEventListener('message', (evt) => {
  if (evt.data?.type !== 'frame-complete') return;
  state.frameCode = evt.data.code || '';
  const ok = state.frameCode === 'ROOM-42';
  status('frameStatus', ok ? 'Iframe challenge complete.' : 'Iframe code invalid.', ok);
  markTask('t7', ok, state.frameCode);
});
const scrollData = Array.from({ length: 120 }, (_, i) => `artifact-${String(i + 1).padStart(3, '0')}`);
scrollData[90] = 'artifact-zx-91';
let rendered = 0;
const list = $('scrollList');
const addChunk = () => {
  const next = scrollData.slice(rendered, rendered + 20);
  next.forEach((name) => {
    const row = document.createElement('div');
    row.className = 'scroll-row';
    row.innerHTML = `<span>${name}</span><button data-item="${name}">Mark</button>`;
    row.querySelector('button').onclick = () => {
      state.markedItem = name;
      const ok = name === 'artifact-zx-91';
      status('scrollStatus', ok ? 'Correct artifact marked.' : `${name} marked (not target).`, ok);
      markTask('t8', ok, name);
    };
    list.appendChild(row);
  });
  rendered += next.length;
};
list.addEventListener('scroll', () => {
  if (list.scrollTop + list.clientHeight >= list.scrollHeight - 6 && rendered < scrollData.length) addChunk();
});
addChunk();
$('validateEditor').addEventListener('click', () => {
  const html = $('editor').innerHTML.toLowerCase();
  const ok =
    html.includes('<h2>agent readiness</h2>') &&
    (html.match(/<li>/g) || []).length >= 3 &&
    html.includes('latency p95 &lt; 2500ms') &&
    html.includes('href="https://docs.example.com/runbook"') &&
    html.includes('>runbook<');
  status('editorStatus', ok ? 'Rich text valid.' : 'Editor content not valid yet.', ok);
  markTask('t9', ok, 'editor');
});
const makeAssetRow = () => {
  const row = document.createElement('div');
  row.className = 'asset-row';
  row.innerHTML = `<input placeholder="name"/><input placeholder="tag"/><select><option value="">priority</option><option>high</option><option>medium</option></select>`;
  $('assetRows').appendChild(row);
};
$('addAsset').addEventListener('click', makeAssetRow);
$('validateAssets').addEventListener('click', () => {
  const owner = $('owner').value.trim();
  const rows = [...document.querySelectorAll('#assetRows .asset-row')].map((r) => {
    const [name, tag, pri] = r.querySelectorAll('input,select');
    return {
      name: name.value.trim().toLowerCase(),
      tag: tag.value.trim().toLowerCase(),
      pri: pri.value.trim().toLowerCase(),
    };
  });
  const hasCsv = rows.some((r) => r.name === 'evidence.csv' && r.tag === 'telemetry' && r.pri === 'high');
  const hasPng = rows.some((r) => r.name === 'screenshot.png' && r.tag === 'ui' && r.pri === 'medium');
  const ok = owner === 'qa-bot' && rows.length === 2 && hasCsv && hasPng;
  status('assetStatus', ok ? 'Asset manifest valid.' : 'Need exactly 2 assets + owner qa-bot.', ok);
  markTask('t10', ok, owner);
});
$('exportJson').addEventListener('click', renderExport);
window.__complexBenchmark = { exportState: () => JSON.parse($('benchmarkJson').value || '{}') };
updateSummary();
