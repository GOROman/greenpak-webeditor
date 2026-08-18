import { Editor } from './editor/editor';
import { NODE_DEFS, NodeType, TRUTH } from './model';
import { PRESETS } from './presets/presets74';
import { Bridge, fromHex, toHex } from './serial/bridge';
import { DB_READY, INPUT_PINS, OUTPUT_PINS, PINS, compile, verifyImage } from './compiler/slg46826';

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

// --- palette ------------------------------------------------------------
const paletteItems: { type: NodeType; label: string; truth?: number }[] = [
  { type: 'gpio_in', label: 'GPIO入力' },
  { type: 'gpio_out', label: 'GPIO出力' },
  { type: 'lut2', label: 'AND', truth: TRUTH.AND2 },
  { type: 'lut2', label: 'OR', truth: TRUTH.OR2 },
  { type: 'lut2', label: 'NAND', truth: TRUTH.NAND2 },
  { type: 'lut2', label: 'NOR', truth: TRUTH.NOR2 },
  { type: 'lut2', label: 'XOR', truth: TRUTH.XOR2 },
  { type: 'lut2', label: 'NOT', truth: TRUTH.INV },
  { type: 'lut3', label: 'LUT3' },
  { type: 'lut4', label: 'LUT4' },
  { type: 'dff', label: 'D-FF' },
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
    // auto-assign the first free GPIO pin
    if (n.type === 'gpio_in' || n.type === 'gpio_out') {
      const used = new Set(
        editor.graph.nodes.filter((x) => x.id !== n.id).map((x) => x.props.pin),
      );
      const pool = n.type === 'gpio_in' ? INPUT_PINS : OUTPUT_PINS;
      const free = pool.find((p) => !used.has(p));
      if (free != null) n.props.pin = free;
    }
    editor.refresh();
  });
  paletteBox.appendChild(b);
}

// --- tools --------------------------------------------------------------
$('#btn-autolayout').addEventListener('click', () => editor.autoLayout());
$('#btn-autoconnect').addEventListener('click', () => {
  const n = editor.autoConnect();
  log(n ? `自動接続: ${n}本配線しました` : '接続できる未配線ポートがありません', n ? 'ok' : '');
});

// --- presets ------------------------------------------------------------
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
    log(`プリセット読込: ${p.name}`, 'ok');
  }
});

// --- property panel -----------------------------------------------------
const propsEl = $('#props');
editor.onSelect = (node) => {
  propsEl.innerHTML = '';
  if (!node) {
    propsEl.innerHTML = '<div class="empty">ノードを選択してください</div>';
    return;
  }
  const title = document.createElement('div');
  title.textContent = `${NODE_DEFS[node.type].title} (${node.label ?? node.id})`;
  propsEl.appendChild(title);

  if (node.type === 'gpio_in' || node.type === 'gpio_out') {
    const label = document.createElement('label');
    label.textContent = 'ピン番号';
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
    const n = Number(node.type[3]);
    const label = document.createElement('label');
    label.textContent = `真理値表 (${1 << n}bit, hex)`;
    const inp = document.createElement('input');
    inp.value = (node.props.truth ?? 0).toString(16).toUpperCase();
    inp.addEventListener('change', () => {
      const v = parseInt(inp.value, 16);
      if (!Number.isNaN(v) && v < 1 << (1 << n)) {
        node.props.truth = v;
        editor.refresh();
      }
    });
    label.appendChild(inp);
    propsEl.appendChild(label);
  }
  if (node.type === 'dff') {
    const label = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !!node.props.invertQ;
    cb.addEventListener('change', () => (node.props.invertQ = cb.checked));
    label.append(cb, ' 反転出力 (nQ)');
    propsEl.appendChild(label);
  }
};
editor.onSelect?.(null);

// --- connection ---------------------------------------------------------
const btnConnect = $('#btn-connect') as HTMLButtonElement;
const writeButtons = ['#btn-write-reg', '#btn-write-nvm', '#btn-read-nvm'].map(
  (s) => $(s) as HTMLButtonElement,
);

function setConnected(c: boolean) {
  btnConnect.textContent = c ? '切断' : '接続';
  btnConnect.classList.toggle('connected', c);
  writeButtons.forEach((b) => (b.disabled = !c));
}
bridge.onDisconnect = () => {
  setConnected(false);
  log('切断されました', 'err');
};

btnConnect.addEventListener('click', async () => {
  if (bridge.connected) {
    await bridge.disconnect();
    return;
  }
  try {
    await bridge.connect();
    const res = await bridge.request({ cmd: 'ping' });
    log(`接続OK: fw ${res.fw}`, 'ok');
    setConnected(true);
    const scan = await bridge.request({ cmd: 'scan' });
    log(`I2Cスキャン: [${(scan.found as number[]).map((a) => '0x' + a.toString(16)).join(', ')}]`);
  } catch (e) {
    log(`接続失敗: ${(e as Error).message}`, 'err');
    await bridge.disconnect();
  }
});

// --- settings dialog ----------------------------------------------------
const dlg = $('#settings-dialog') as unknown as HTMLDialogElement;
$('#btn-settings').addEventListener('click', () => dlg.showModal());
$('#cfg-apply').addEventListener('click', async () => {
  if (!bridge.connected) {
    log('未接続のため設定は保留 (接続後に再適用してください)', 'err');
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
    log(`I2C設定: SDA=${res.sda} SCL=${res.scl} ${Number(res.freq) / 1000}kHz`, 'ok');
  } catch (e) {
    log(`設定失敗: ${(e as Error).message}`, 'err');
  }
});

// --- compile & write ----------------------------------------------------
function buildImage(): Uint8Array | null {
  try {
    const { image, warnings } = compile(editor.graph);
    warnings.forEach((w) => log(`警告: ${w}`, 'err'));
    return image;
  } catch (e) {
    log(`コンパイルエラー: ${(e as Error).message}`, 'err');
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
    log('レジスタ書込完了 (揮発)', 'ok');
  } catch (e) {
    log(`書込失敗: ${(e as Error).message}`, 'err');
  }
});

$('#btn-write-nvm').addEventListener('click', async () => {
  const image = buildImage();
  if (!image) return;
  if (!confirm('NVMへ書き込みます。書換回数は約1000回に制限されています。実行しますか?')) return;
  try {
    const res = await bridge.request({ cmd: 'nvm_write', data: toHex(image) }, 30000);
    const bad = verifyImage(image, fromHex(res.readback as string));
    if (bad.length === 0) log('NVM書込+ベリファイOK', 'ok');
    else log(`ベリファイ不一致: ${bad.length}バイト (${bad.slice(0, 8).map((b) => '0x' + b.toString(16)).join(',')}…)`, 'err');
  } catch (e) {
    log(`NVM書込失敗: ${(e as Error).message}`, 'err');
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
    log('NVM内容:\n' + dump);
  } catch (e) {
    log(`読出失敗: ${(e as Error).message}`, 'err');
  }
});

if (!DB_READY) {
  log('注意: デバイステーブル整備中のためコンパイル/書込は未有効です', 'err');
}
if (!('serial' in navigator)) {
  log('このブラウザはWebSerial非対応です。Chrome/Edgeを使用してください。', 'err');
}
