// Tiny i18n: ja / en / zh. t(key, params) looks up the current language,
// falling back to Japanese. Language persists in localStorage.

export type Lang = 'ja' | 'en' | 'zh';

const STRINGS: Record<string, [ja: string, en: string, zh: string]> = {
  // section headings
  h_blocks: ['ブロック', 'Blocks', '模块'],
  h_tools: ['ツール', 'Tools', '工具'],
  h_write: ['書き込み', 'Program', '写入'],
  h_file: ['ファイル', 'File', '文件'],
  h_props: ['プロパティ', 'Properties', '属性'],
  h_log: ['ログ', 'Log', '日志'],
  // buttons
  b_autolayout: ['✨ 自動整列', '✨ Auto layout', '✨ 自动排列'],
  b_autoconnect: ['🔗 自動接続', '🔗 Auto connect', '🔗 自动连线'],
  b_write_reg: ['レジスタへ書込 (揮発)', 'Write registers (volatile)', '写入寄存器 (易失)'],
  b_write_nvm: ['NVMへ書込 (不揮発)', 'Write NVM (permanent)', '写入NVM (非易失)'],
  b_read_nvm: ['NVM読出', 'Read NVM', '读取NVM'],
  b_monitor_off: ['📡 実機モニタ OFF', '📡 Live monitor OFF', '📡 实机监视 OFF'],
  b_monitor_on: ['📡 実機モニタ ON', '📡 Live monitor ON', '📡 实机监视 ON'],
  b_save: ['💾 保存 (JSON)', '💾 Save (JSON)', '💾 保存 (JSON)'],
  b_load: ['📂 読込', '📂 Load', '📂 载入'],
  b_share: ['🔗 共有URLコピー', '🔗 Copy share URL', '🔗 复制分享URL'],
  b_connect: ['接続', 'Connect', '连接'],
  b_disconnect: ['切断', 'Disconnect', '断开'],
  preset_placeholder: ['― 74シリーズ プリセット ―', '― 74-series presets ―', '― 74系列预设 ―'],
  // settings dialog
  d_title: ['ブリッジ設定 (M5StampS3)', 'Bridge settings (M5StampS3)', '桥接设置 (M5StampS3)'],
  d_freq: ['I2C周波数', 'I2C frequency', 'I2C频率'],
  d_save_nvs: ['本体NVSに保存する', 'Persist to device NVS', '保存到设备NVS'],
  d_cancel: ['キャンセル', 'Cancel', '取消'],
  d_apply: ['適用', 'Apply', '应用'],
  // property panel
  p_pin: ['ピン番号', 'Pin', '引脚'],
  p_truth: ['真理値表 ({n}bit, hex)', 'Truth table ({n}bit, hex)', '真值表 ({n}bit, hex)'],
  p_invert_q: [' 反転出力 (nQ)', ' Inverted output (nQ)', ' 反相输出 (nQ)'],
  p_virt_index: ['仮想入力番号', 'Virtual input #', '虚拟输入编号'],
  p_clock_src: ['クロック源', 'Clock source', '时钟源'],
  p_select_node: ['ノードを選択してください', 'Select a node', '请选择节点'],
  // resource meter
  m_cells: ['セル', 'Cells', '单元'],
  m_dff: ['DFF', 'DFF', 'DFF'],
  m_pins: ['ピン', 'Pins', '引脚'],
  m_virt: ['VIN', 'VIN', 'VIN'],
  // logs / errors
  l_connected: ['接続OK: fw {fw}', 'Connected: fw {fw}', '已连接: fw {fw}'],
  l_conn_failed: ['接続失敗: {msg}', 'Connect failed: {msg}', '连接失败: {msg}'],
  l_disconnected: ['切断されました', 'Disconnected', '已断开'],
  l_scan: ['I2Cスキャン: [{list}]', 'I2C scan: [{list}]', 'I2C扫描: [{list}]'],
  l_preset: ['プリセット読込: {name}', 'Preset loaded: {name}', '已载入预设: {name}'],
  l_autoconnect_done: ['自動接続: {n}本配線しました', 'Auto connect: wired {n} nets', '自动连线: 已连接{n}条'],
  l_autoconnect_none: ['接続できる未配線ポートがありません', 'No unwired ports to connect', '没有可连接的未连线端口'],
  l_cfg_pending: ['未接続のため設定は保留 (接続後に再適用してください)', 'Not connected — apply again after connecting', '未连接—请连接后再应用'],
  l_cfg_done: ['I2C設定: SDA={sda} SCL={scl} {khz}kHz', 'I2C config: SDA={sda} SCL={scl} {khz}kHz', 'I2C设置: SDA={sda} SCL={scl} {khz}kHz'],
  l_cfg_failed: ['設定失敗: {msg}', 'Config failed: {msg}', '设置失败: {msg}'],
  l_compile_err: ['コンパイルエラー: {msg}', 'Compile error: {msg}', '编译错误: {msg}'],
  l_warn: ['警告: {msg}', 'Warning: {msg}', '警告: {msg}'],
  l_reg_done: ['レジスタ書込完了 (揮発)', 'Registers written (volatile)', '寄存器写入完成 (易失)'],
  l_write_failed: ['書込失敗: {msg}', 'Write failed: {msg}', '写入失败: {msg}'],
  l_nvm_confirm: [
    'NVMへ書き込みます。書換回数は約1000回に制限されています。実行しますか?',
    'Write to NVM? Endurance is limited to ~1000 cycles.',
    '将写入NVM。擦写次数限制约1000次。继续吗?',
  ],
  l_nvm_ok: ['NVM書込+ベリファイOK', 'NVM written + verified OK', 'NVM写入+校验OK'],
  l_nvm_mismatch: ['ベリファイ不一致: {n}バイト ({bytes}…)', 'Verify mismatch: {n} bytes ({bytes}…)', '校验不一致: {n}字节 ({bytes}…)'],
  l_nvm_failed: ['NVM書込失敗: {msg}', 'NVM write failed: {msg}', 'NVM写入失败: {msg}'],
  l_nvm_dump: ['NVM内容:', 'NVM contents:', 'NVM内容:'],
  l_read_failed: ['読出失敗: {msg}', 'Read failed: {msg}', '读取失败: {msg}'],
  l_virt_failed: ['仮想入力書込失敗: {msg}', 'Virtual input write failed: {msg}', '虚拟输入写入失败: {msg}'],
  l_loaded_file: ['読込: {name}', 'Loaded: {name}', '已载入: {name}'],
  l_load_failed: ['読込失敗: {msg}', 'Load failed: {msg}', '载入失败: {msg}'],
  l_bad_format: ['形式が不正', 'Invalid format', '格式无效'],
  l_share_copied: ['共有URLをコピーしました ({n}文字)', 'Share URL copied ({n} chars)', '已复制分享URL ({n}字符)'],
  l_hash_loaded: ['共有URLからグラフを読み込みました', 'Graph loaded from share URL', '已从分享URL载入电路'],
  l_hash_failed: ['共有URLの読み込みに失敗しました', 'Failed to load the share URL', '分享URL载入失败'],
  l_no_webserial: [
    'このブラウザはWebSerial非対応です。Chrome/Edgeを使用してください。',
    'This browser does not support WebSerial. Use Chrome/Edge.',
    '此浏览器不支持WebSerial。请使用Chrome/Edge。',
  ],
  // bridge errors
  e_no_webserial: ['WebSerial非対応ブラウザです。Chrome/Edgeを使ってください。', 'WebSerial is not supported. Use Chrome/Edge.', '不支持WebSerial。请使用Chrome/Edge。'],
  e_not_connected: ['未接続です', 'Not connected', '未连接'],
  e_timeout: ['応答タイムアウト', 'Response timeout', '响应超时'],
  e_disconnected: ['切断されました', 'Disconnected', '已断开'],
  e_bridge: ['ブリッジエラー', 'Bridge error', '桥接错误'],
  // compiler errors
  c_no_pin: ['{name}: ピン未指定', '{name}: no pin assigned', '{name}: 未指定引脚'],
  c_pin_dup: ['ピン{pin}が重複しています', 'Pin {pin} is used twice', '引脚{pin}重复使用'],
  c_not_gpio: ['ピン{pin}はGPIOではありません', 'Pin {pin} is not a GPIO', '引脚{pin}不是GPIO'],
  c_out_only: ['{name}: ピン{pin} ({id}) は出力専用です', '{name}: pin {pin} ({id}) is output-only', '{name}: 引脚{pin} ({id}) 仅可输出'],
  c_out_only_src: ['{id} は出力専用ピンです (入力に使えません)', '{id} is output-only (cannot be used as input)', '{id} 仅可输出 (不能作为输入)'],
  c_no_lut: ['LUTリソースが不足しています', 'Out of LUT resources', 'LUT资源不足'],
  c_no_lut3: ['LUT3リソースが不足しています', 'Out of 3-bit LUT resources', 'LUT3资源不足'],
  c_one_lut4: ['LUT4は1個しかありません', 'Only one LUT4 exists', 'LUT4只有一个'],
  c_no_dff: ['DFFリソースが不足しています', 'Out of DFF resources', 'DFF资源不足'],
  c_no_virt: ['{name}: 仮想入力番号(0-7)が未指定です', '{name}: virtual input index (0-7) not set', '{name}: 未指定虚拟输入编号(0-7)'],
  c_virt_dup: ['仮想入力{n}が重複しています', 'Virtual input {n} is used twice', '虚拟输入{n}重复使用'],
  c_unconnected: ['{name}: {port} が未接続', '{name}: {port} is unconnected', '{name}: {port} 未连接'],
  c_in_unconnected: ['{name}: 入力が未接続です', '{name}: input is unconnected', '{name}: 输入未连接'],
  c_in_gnd: ['{name}: in{i} が未接続 (GND扱い)', '{name}: in{i} unconnected (treated as GND)', '{name}: in{i} 未连接 (视为GND)'],
  c_no_pins_preset: ['プリセットに割り当てるピンが不足', 'Not enough pins for the preset', '预设可用引脚不足'],
  c_cell_incompat: ['セル{cell}はこのブロックに使えません', 'Cell {cell} is incompatible with this block', '单元{cell}与此模块不兼容'],
  c_cell_taken: ['セル{cell}は既に使用されています', 'Cell {cell} is already in use', '单元{cell}已被占用'],
  // connections panel
  h_conns: ['接続リスト', 'Connections', '连线列表'],
  conn_empty: ['接続なし', 'No connections', '无连线'],
  // truth-table extras
  p_invert_in: ['入力を反転', 'Invert input', '反相输入'],
  p_invert_out: ['~OUT', '~OUT', '~OUT'],
  p_expr: ['論理式 (例: in0 & ~in1 | in2)', 'Expression (e.g. in0 & ~in1 | in2)', '逻辑式 (例: in0 & ~in1 | in2)'],
  l_expr_err: ['式エラー: {msg}', 'Expression error: {msg}', '表达式错误: {msg}'],
  // macrocell panel
  p_cell: ['配置マクロセル', 'Macrocell', '宏单元'],
  p_cell_auto: ['自動', 'Auto', '自动'],
  p_cell_now: ['現在の配置: {cell}', 'Placed on: {cell}', '当前配置: {cell}'],
  p_cell_mode: ['モード: {mode}', 'Mode: {mode}', '模式: {mode}'],
  p_cnt_note: [
    'CNT/DLYモードは未対応です (LUT/DFFのみ)',
    'CNT/DLY modes are not supported yet (LUT/DFF only)',
    '暂不支持CNT/DLY模式 (仅LUT/DFF)',
  ],
};

const LANG_KEY = 'gpweb-lang';
const hasDom = typeof localStorage !== 'undefined' && typeof navigator !== 'undefined';
let current: Lang = (hasDom && (localStorage.getItem(LANG_KEY) as Lang)) || detect();

function detect(): Lang {
  const l = hasDom ? navigator.language.toLowerCase() : 'ja';
  if (l.startsWith('ja')) return 'ja';
  if (l.startsWith('zh')) return 'zh';
  return 'en';
}

export function getLang(): Lang {
  return current;
}

export function setLang(l: Lang) {
  current = l;
  if (hasDom) localStorage.setItem(LANG_KEY, l);
}

export function t(key: string, params?: Record<string, string | number>): string {
  const entry = STRINGS[key];
  let s = entry ? entry[current === 'ja' ? 0 : current === 'en' ? 1 : 2] : key;
  if (params) for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}
