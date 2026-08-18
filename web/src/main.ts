import { Editor } from './editor/editor';
import { GraphNode, NODE_DEFS, NodeType, TRUTH } from './model';
import { PRESETS } from './presets/presets74';
import { Bridge, fromHex, toHex } from './serial/bridge';
import { DB_READY, INPUT_PINS, OUTPUT_PINS, PINS, compile, verifyImage } from './compiler/slg46826';
import { Lang, getLang, setLang, t } from './i18n';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;

const editor = new Editor($('#canvas'));
const bridge = new Bridge();
const logEl = $('#log');

function log(msg: string, cls = '') {
  const line = document.createElement('div');
  if (cls) line.className = cls;
  line.textContent = msg;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
}
bridge.onLog = (dir, line) => {
  if (line.length > 120) line = line.slice(0, 117) + '…';
  log(`${dir === 'tx' ? '→' : '←'} ${line}`);
};

// --- i18n ----------------------------------------------------------------
function applyI18n() {
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n!);
  });
  const bc = $('#btn-connect');
  bc.textContent = t(bridge.connected ? 'b_disconnect' : 'b_connect');
  btnMonitor.textContent = t(monitorTimer != null ? 'b_monitor_on' : 'b_monitor_off');
  updateMeter();
  editor.onSelect?.(selectedNode());
}
const langSel = $('#lang-select') as unknown as HTMLSelectElement;
langSel.value = getLang();
langSel.addEventListener('change', () => {
  setLang(langSel.value as Lang);
  applyI18n();
});

function selectedNode(): GraphNode | null {
  return editor.graph.nodes.find((n) => n.id === editor.selected) ?? null;
}

// --- palette -------------------------------------------------------------
const paletteItems: { type: NodeType; label: string; truth?: number }[] = [
  { type: 'gpio_in', label: 'GPIO IN' },
  { type: 'gpio_out', label: 'GPIO OUT' },
  { type: 'lut2', label: 'AND', truth: TRUTH.AND2 },
  { type: 'lut2', label: 'OR', truth: TRUTH.OR2 },
  { type: 'lut2', label: 'NAND', truth: TRUTH.NAND2 },
  { type: 'lut2', label: 'NOR', truth: TRUTH.NOR2 },
  { type: 'lut2', label: 'XOR', truth: TRUTH.XOR2 },
  { type: 'lut2', label: 'NOT', truth: TRUTH.INV },
  { type: 'lut3', label: 'LUT3' },
  { type: 'lut4', label: 'LUT4' },
  { type: 'dff', label: 'D-FF' },
  { type: 'virt_in', label: 'I2C IN' },
  { type: 'osc', label: 'OSC' },
  { type: 'vdd', label: 'VDD' },
  { type: 'gnd', label: 'GND' },
];
const paletteBox = $('#palette-buttons');
for (const item of paletteItems) {
  const b = document.createElement('button');
  b.textContent = item.label;
  b.addEventListener('click', () => {
    const n = editor.addNode(item.type, 80 + Math.random() * 60, 80 + Math.random() * 60);
    if (item.truth != null) {
      n.props.truth = item.truth;
      n.label = item.label;
    }
    // auto-assign the first free GPIO pin / virtual input index
    if (n.type === 'gpio_in' || n.type === 'gpio_out') {
      const used = new Set(
        editor.graph.nodes.filter((x) => x.id !== n.id).map((x) => x.props.pin),
      );
      const pool = n.type === 'gpio_in' ? INPUT_PINS : OUTPUT_PINS;
      const free = pool.find((p) => !used.has(p));
      if (free != null) n.props.pin = free;
    }
    if (n.type === 'virt_in') {
      const used = new Set(
        editor.graph.nodes.filter((x) => x.id !== n.id).map((x) => x.props.virtIndex),
      );
      for (let i = 0; i < 8; i++) if (!used.has(i)) { n.props.virtIndex = i; break; }
    }
    if (n.type === 'osc') n.props.osc = 'osc0_2k';
    editor.refresh();
  });
  paletteBox.appendChild(b);
}

// --- tools ---------------------------------------------------------------
$('#btn-autolayout').addEventListener('click', () => editor.autoLayout());
$('#btn-autoconnect').addEventListener('click', () => {
  const n = editor.autoConnect();
  log(n ? t('l_autoconnect_done', { n }) : t('l_autoconnect_none'), n ? 'ok' : '');
});

// --- presets -------------------------------------------------------------
const presetSel = $('#preset-select') as unknown as HTMLSelectElement;
for (const p of PRESETS) {
  const o = document.createElement('option');
  o.value = p.id;
  o.textContent = p.name;
  presetSel.appendChild(o);
}
presetSel.addEventListener('change', () => {
  const p = PRESETS.find((pp) => pp.id === presetSel.value);
  if (p) {
    editor.setGraph(p.build());
    pushHistory();
    updateMeter();
    log(t('l_preset', { name: p.name }), 'ok');
  }
});

// --- property panel ------------------------------------------------------
const propsEl = $('#props');

/** friendly truth-table editor: gate presets + clickable output bits */
function buildTruthEditor(node: GraphNode) {
  const nIn = Number(node.type[3]);
  const rows = 1 << nIn;
  const wrap = document.createElement('div');
  wrap.className = 'truth-editor';

  // gate presets
  const gates: [string, number][] =
    nIn === 2
      ? [
          ['AND', TRUTH.AND2], ['OR', TRUTH.OR2], ['NAND', TRUTH.NAND2],
          ['NOR', TRUTH.NOR2], ['XOR', TRUTH.XOR2], ['XNOR', TRUTH.XNOR2],
          ['NOT', TRUTH.INV], ['BUF', TRUTH.BUF],
        ]
      : nIn === 3
        ? [
            ['AND', 0x80], ['OR', 0xfe], ['NAND', 0x7f], ['NOR', 0x01],
            ['XOR', 0x96], ['MUX', 0xca],
          ]
        : [
            ['AND', 0x8000], ['OR', 0xfffe], ['NAND', 0x7fff], ['NOR', 0x0001],
            ['XOR', 0x6996],
          ];
  const gateBox = document.createElement('div');
  gateBox.className = 'gate-presets';
  for (const [nm, tr] of gates) {
    const gb = document.createElement('button');
    gb.textContent = nm;
    gb.classList.toggle('active', (node.props.truth ?? 0) === tr);
    gb.addEventListener('click', () => {
      node.props.truth = tr;
      node.label = undefined;
      editor.refresh();
      renderProps(node);
    });
    gateBox.appendChild(gb);
  }
  wrap.appendChild(gateBox);

  // clickable truth table
  const table = document.createElement('table');
  table.className = 'truth-table';
  const thead = document.createElement('tr');
  for (let i = nIn - 1; i >= 0; i--) {
    const th = document.createElement('th');
    th.textContent = `in${i}`;
    thead.appendChild(th);
  }
  const thO = document.createElement('th');
  thO.textContent = 'out';
  thO.className = 'out-col';
  thead.appendChild(thO);
  table.appendChild(thead);
  for (let v = 0; v < rows; v++) {
    const tr = document.createElement('tr');
    for (let i = nIn - 1; i >= 0; i--) {
      const td = document.createElement('td');
      td.textContent = String((v >> i) & 1);
      tr.appendChild(td);
    }
    const out = document.createElement('td');
    const bitv = ((node.props.truth ?? 0) >> v) & 1;
    out.textContent = String(bitv);
    out.className = `out-col clickable ${bitv ? 'hi' : 'lo'}`;
    out.addEventListener('click', () => {
      node.props.truth = (node.props.truth ?? 0) ^ (1 << v);
      node.label = undefined;
      editor.refresh();
      renderProps(node);
    });
    tr.appendChild(out);
    table.appendChild(tr);
  }
  wrap.appendChild(table);

  // hex field stays for power users
  const label = document.createElement('label');
  label.textContent = t('p_truth', { n: rows });
  const inp = document.createElement('input');
  inp.value = (node.props.truth ?? 0).toString(16).toUpperCase();
  inp.addEventListener('change', () => {
    const v = parseInt(inp.value, 16);
    if (!Number.isNaN(v) && v < 1 << rows) {
      node.props.truth = v;
      node.label = undefined;
      editor.refresh();
      renderProps(node);
    }
  });
  label.appendChild(inp);
  wrap.appendChild(label);
  return wrap;
}

function renderProps(node: GraphNode | null) {
  propsEl.innerHTML = '';
  if (!node) {
    propsEl.innerHTML = `<div class="empty">${t('p_select_node')}</div>`;
    return;
  }
  const title = document.createElement('div');
  title.className = 'props-title';
  title.textContent = `${NODE_DEFS[node.type].title} (${node.label ?? node.id})`;
  propsEl.appendChild(title);

  if (node.type === 'gpio_in' || node.type === 'gpio_out') {
    const label = document.createElement('label');
    label.textContent = t('p_pin');
    const sel = document.createElement('select');
    const candidates = node.type === 'gpio_in' ? PINS.filter((p) => p.inputCapable) : PINS;
    for (const { pin, id } of candidates) {
      const o = document.createElement('option');
      o.value = String(pin);
      o.textContent = `Pin ${pin} (${id})`;
      sel.appendChild(o);
    }
    if (node.props.pin != null) sel.value = String(node.props.pin);
    sel.addEventListener('change', () => {
      node.props.pin = Number(sel.value);
      editor.refresh();
    });
    label.appendChild(sel);
    propsEl.appendChild(label);
  }
  if (node.type.startsWith('lut')) {
    propsEl.appendChild(buildTruthEditor(node));
  }
  if (node.type === 'dff') {
    const label = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !!node.props.invertQ;
    cb.addEventListener('change', () => {
      node.props.invertQ = cb.checked;
      editor.refresh();
    });
    label.append(cb, t('p_invert_q'));
    propsEl.appendChild(label);
  }
  if (node.type === 'virt_in') {
    const label = document.createElement('label');
    label.textContent = t('p_virt_index');
    const sel = document.createElement('select');
    for (let i = 0; i < 8; i++) {
      const o = document.createElement('option');
      o.value = String(i);
      o.textContent = `VIN${i}`;
      sel.appendChild(o);
    }
    sel.value = String(node.props.virtIndex ?? 0);
    sel.addEventListener('change', () => {
      node.props.virtIndex = Number(sel.value);
      editor.refresh();
    });
    label.appendChild(sel);
    propsEl.appendChild(label);
  }
  if (node.type === 'osc') {
    const label = document.createElement('label');
    label.textContent = t('p_clock_src');
    const sel = document.createElement('select');
    for (const [v, txt] of [
      ['osc0_2k', 'OSC0 2.048 kHz'],
      ['osc1_2m', 'OSC1 2.048 MHz'],
      ['osc2_25m', 'OSC2 25 MHz'],
    ]) {
      const o = document.createElement('option');
      o.value = v;
      o.textContent = txt;
      sel.appendChild(o);
    }
    sel.value = node.props.osc ?? 'osc0_2k';
    sel.addEventListener('change', () => {
      node.props.osc = sel.value as typeof node.props.osc;
      editor.refresh();
    });
    label.appendChild(sel);
    propsEl.appendChild(label);
  }
}
editor.onSelect = renderProps;
renderProps(null);

// --- connection ----------------------------------------------------------
const btnConnect = $('#btn-connect') as HTMLButtonElement;
const writeButtons = ['#btn-write-reg', '#btn-write-nvm', '#btn-read-nvm', '#btn-monitor'].map(
  (s) => $(s) as HTMLButtonElement,
);

function setConnected(c: boolean) {
  btnConnect.textContent = t(c ? 'b_disconnect' : 'b_connect');
  btnConnect.classList.toggle('connected', c);
  writeButtons.forEach((b) => (b.disabled = !c));
}
bridge.onDisconnect = () => {
  setConnected(false);
  log(t('l_disconnected'), 'err');
};

btnConnect.addEventListener('click', async () => {
  if (bridge.connected) {
    await bridge.disconnect();
    return;
  }
  try {
    await bridge.connect();
    const res = await bridge.request({ cmd: 'ping' });
    log(t('l_connected', { fw: String(res.fw) }), 'ok');
    setConnected(true);
    const scan = await bridge.request({ cmd: 'scan' });
    log(t('l_scan', { list: (scan.found as number[]).map((a) => '0x' + a.toString(16)).join(', ') }));
  } catch (e) {
    log(t('l_conn_failed', { msg: (e as Error).message }), 'err');
    await bridge.disconnect();
  }
});

// --- settings dialog -----------------------------------------------------
const dlg = $('#settings-dialog') as unknown as HTMLDialogElement;
$('#btn-settings').addEventListener('click', () => dlg.showModal());
$('#cfg-apply').addEventListener('click', async () => {
  if (!bridge.connected) {
    log(t('l_cfg_pending'), 'err');
    return;
  }
  try {
    const res = await bridge.request({
      cmd: 'i2c_config',
      sda: Number(($('#cfg-sda') as HTMLInputElement).value),
      scl: Number(($('#cfg-scl') as HTMLInputElement).value),
      freq: Number(($('#cfg-freq') as unknown as HTMLSelectElement).value),
      save: ($('#cfg-save') as HTMLInputElement).checked,
    });
    log(t('l_cfg_done', { sda: String(res.sda), scl: String(res.scl), khz: Number(res.freq) / 1000 }), 'ok');
  } catch (e) {
    log(t('l_cfg_failed', { msg: (e as Error).message }), 'err');
  }
});

// --- compile & write -----------------------------------------------------
function buildImage(): Uint8Array | null {
  try {
    const { image, warnings } = compile(editor.graph);
    warnings.forEach((w) => log(t('l_warn', { msg: w }), 'err'));
    return image;
  } catch (e) {
    log(t('l_compile_err', { msg: (e as Error).message }), 'err');
    return null;
  }
}

// register-space offsets it is unsafe to write at runtime
// (0xC8 reset, 0xCA I2C control code, 0xE3 ERSR erase trigger)
const VOLATILE_SKIP = new Set([0xc8, 0xca, 0xe3]);

$('#btn-write-reg').addEventListener('click', async () => {
  const image = buildImage();
  if (!image) return;
  try {
    let start = 0;
    while (start < 0xf0) {
      let end = start;
      while (end < 0xf0 && !VOLATILE_SKIP.has(end)) end++;
      if (end > start) {
        await bridge.request({
          cmd: 'reg_write',
          off: start,
          data: toHex(image.slice(start, end)),
        });
      }
      start = end + 1;
    }
    await pushVirtualInputs();
    log(t('l_reg_done'), 'ok');
  } catch (e) {
    log(t('l_write_failed', { msg: (e as Error).message }), 'err');
  }
});

$('#btn-write-nvm').addEventListener('click', async () => {
  const image = buildImage();
  if (!image) return;
  if (!confirm(t('l_nvm_confirm'))) return;
  try {
    const res = await bridge.request({ cmd: 'nvm_write', data: toHex(image) }, 30000);
    const bad = verifyImage(image, fromHex(res.readback as string));
    if (bad.length === 0) log(t('l_nvm_ok'), 'ok');
    else
      log(
        t('l_nvm_mismatch', {
          n: bad.length,
          bytes: bad.slice(0, 8).map((b) => '0x' + b.toString(16)).join(','),
        }),
        'err',
      );
  } catch (e) {
    log(t('l_nvm_failed', { msg: (e as Error).message }), 'err');
  }
});

$('#btn-read-nvm').addEventListener('click', async () => {
  try {
    const res = await bridge.request({ cmd: 'nvm_read' });
    const data = fromHex(res.data as string);
    let dump = '';
    for (let r = 0; r < 16; r++) {
      dump += r.toString(16).toUpperCase() + '0: ' + toHex(data.slice(r * 16, r * 16 + 16)) + '\n';
    }
    log(t('l_nvm_dump') + '\n' + dump);
  } catch (e) {
    log(t('l_read_failed', { msg: (e as Error).message }), 'err');
  }
});

// --- I2C virtual inputs: push toggles to the chip when connected ---------
async function pushVirtualInputs() {
  if (!bridge.connected) return;
  let byte = 0;
  for (const n of editor.graph.nodes) {
    if (n.type === 'virt_in' && n.props.value) byte |= 1 << (7 - (n.props.virtIndex ?? 0));
  }
  try {
    await bridge.request({ cmd: 'reg_write', off: 0x7a, data: byte.toString(16).padStart(2, '0') });
  } catch (e) {
    log(t('l_virt_failed', { msg: (e as Error).message }), 'err');
  }
}
editor.onToggle = (node) => {
  if (node.type === 'virt_in') void pushVirtualInputs();
};

// --- OSC preview blink (visual 2Hz regardless of real frequency) ---------
setInterval(() => {
  const oscs = editor.graph.nodes.filter((n) => n.type === 'osc');
  if (!oscs.length) return;
  for (const n of oscs) n.props.value = n.props.value ? 0 : 1;
  editor.refresh();
}, 250);

// --- live hardware monitor ------------------------------------------------
// Matrix input values are readable at registers 0x74-0x7B (matrix input N =
// bit N of that 64-bit window); each GPIO pad's real level drives its
// gpio_in node so the on-screen logic follows the actual chip.
const btnMonitor = $('#btn-monitor') as HTMLButtonElement;
let monitorTimer: number | null = null;
function setMonitor(on: boolean) {
  if (monitorTimer != null) clearInterval(monitorTimer);
  monitorTimer = null;
  btnMonitor.textContent = t(on ? 'b_monitor_on' : 'b_monitor_off');
  btnMonitor.classList.toggle('connected', on);
  if (!on) return;
  monitorTimer = window.setInterval(async () => {
    if (!bridge.connected) return setMonitor(false);
    try {
      const res = await bridge.request({ cmd: 'reg_read', off: 0x74, len: 8 });
      const bytes = fromHex(res.data as string);
      let changed = false;
      for (const n of editor.graph.nodes) {
        if (n.type !== 'gpio_in') continue;
        const info = PINS.find((p) => p.pin === n.props.pin);
        if (!info || info.matrixInputIndex < 0) continue;
        const N = info.matrixInputIndex;
        const v: 0 | 1 = (bytes[N >> 3] >> (N & 7)) & 1 ? 1 : 0;
        if (n.props.value !== v) {
          n.props.value = v;
          changed = true;
        }
      }
      if (changed) editor.refresh();
    } catch {
      /* transient read errors are fine while polling */
    }
  }, 400);
}
btnMonitor.addEventListener('click', () => setMonitor(monitorTimer == null));

// --- resource meter (header gauges) --------------------------------------
// SLG46826: 19 LUT/DFF macrocells (13 of them DFF-capable), 15 IO pads,
// 8 I2C virtual inputs.
function updateMeter() {
  const g = editor.graph;
  const gauge = (label: string, used: number, total: number) => {
    const pct = Math.min(100, (used / total) * 100);
    const over = used > total ? ' over' : '';
    return (
      `<div class="gauge${over}"><span class="g-label">${label}</span>` +
      `<div class="g-bar"><div class="g-fill" style="width:${pct}%"></div></div>` +
      `<span class="g-num">${used}/${total}</span></div>`
    );
  };
  const cells = g.nodes.filter((n) => /^lut|^dff/.test(n.type)).length;
  const dffs = g.nodes.filter((n) => n.type === 'dff').length;
  const pins = g.nodes.filter((n) => n.type === 'gpio_in' || n.type === 'gpio_out').length;
  const virts = g.nodes.filter((n) => n.type === 'virt_in').length;
  $('#meter').innerHTML =
    gauge(t('m_cells'), cells, 19) +
    gauge(t('m_dff'), dffs, 13) +
    gauge(t('m_pins'), pins, 15) +
    gauge(t('m_virt'), virts, 8);
}

// --- save / load / share -------------------------------------------------
$('#btn-save').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(editor.graph, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'greenpak-graph.json';
  a.click();
  URL.revokeObjectURL(a.href);
});
const fileInput = $('#file-input') as HTMLInputElement;
$('#btn-load').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', async () => {
  const f = fileInput.files?.[0];
  if (!f) return;
  try {
    const g = JSON.parse(await f.text());
    if (!Array.isArray(g.nodes) || !Array.isArray(g.edges)) throw new Error(t('l_bad_format'));
    editor.setGraph(g);
    pushHistory();
    updateMeter();
    log(t('l_loaded_file', { name: f.name }), 'ok');
  } catch (e) {
    log(t('l_load_failed', { msg: (e as Error).message }), 'err');
  }
  fileInput.value = '';
});
$('#btn-share').addEventListener('click', async () => {
  const enc = btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(editor.graph))));
  const url = `${location.origin}${location.pathname}#g=${enc}`;
  await navigator.clipboard.writeText(url);
  log(t('l_share_copied', { n: url.length }), 'ok');
});
function loadFromHash(): boolean {
  const m = location.hash.match(/#g=(.+)/);
  if (!m) return false;
  try {
    const json = new TextDecoder().decode(Uint8Array.from(atob(m[1]), (c) => c.charCodeAt(0)));
    editor.setGraph(JSON.parse(json));
    log(t('l_hash_loaded'), 'ok');
    return true;
  } catch {
    log(t('l_hash_failed'), 'err');
    return false;
  }
}

// --- undo / redo ---------------------------------------------------------
const undoStack: string[] = [JSON.stringify(editor.graph)];
const redoStack: string[] = [];
function pushHistory() {
  undoStack.push(JSON.stringify(editor.graph));
  if (undoStack.length > 100) undoStack.shift();
  redoStack.length = 0;
}
editor.onChange = () => {
  pushHistory();
  updateMeter();
};
window.addEventListener('keydown', (e) => {
  if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return;
  const tag = (e.target as HTMLElement).tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
  e.preventDefault();
  if (e.shiftKey) {
    if (!redoStack.length) return;
    const s = redoStack.pop()!;
    undoStack.push(s);
    editor.setGraph(JSON.parse(s));
  } else {
    if (undoStack.length < 2) return;
    redoStack.push(undoStack.pop()!);
    editor.setGraph(JSON.parse(undoStack[undoStack.length - 1]));
  }
  updateMeter();
});

loadFromHash();
applyI18n();

if (!DB_READY) {
  log('device table not ready', 'err');
}
if (!('serial' in navigator)) {
  log(t('l_no_webserial'), 'err');
}
