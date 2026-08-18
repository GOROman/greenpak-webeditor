// Graph -> 256-byte SLG46826 config image compiler.
import { Graph, GraphNode } from '../model';
import {
  IO_PADS,
  IoPad,
  LUTS,
  LutCell,
  MATRIX_SOURCES,
  OSC,
  blankImage,
  setBit,
  setField,
} from './device-slg46826';

export const DB_READY = true;

const GND = MATRIX_SOURCES.GND;
const VDD = MATRIX_SOURCES.VDD;

/** matrix input index of each LUT/DFF cell's output (Table 21) */
const OUTPUT_INDEX: Record<string, number> = {
  LUT2_0: 14, LUT2_1: 15, LUT2_2: 16, LUT2_3: 17,
  LUT3_0: 18, LUT3_1: 19, LUT3_2: 20, LUT3_3: 21, LUT3_4: 22, LUT3_5: 23,
  LUT3_6: 24,
  LUT4_0: 39,
  LUT3_7: 40, LUT3_8: 41, LUT3_9: 42, LUT3_10: 43, LUT3_11: 44, LUT3_12: 45,
  LUT3_13: 46,
};

export interface PinInfo {
  pin: number; // DIP module pin number (= TSSOP-20 pin)
  id: string; // IO name
  inputCapable: boolean;
  /** matrix input index of the pad (readable live at reg 0x74+), -1 for GPO */
  matrixInputIndex: number;
}

export const PINS: PinInfo[] = IO_PADS.map((p) => ({
  pin: p.tssopPin,
  id: p.id,
  inputCapable: p.kind === 'GPIO',
  matrixInputIndex: p.matrixInputIndex,
})).sort((a, b) => a.pin - b.pin);

/** all logic-usable pins (both directions listed; inputs must be GPIO pads) */
export const AVAILABLE_PINS: number[] = PINS.map((p) => p.pin);
export const INPUT_PINS: number[] = PINS.filter((p) => p.inputCapable).map((p) => p.pin);
/** output pins ordered GPO-first so presets keep GPIO pads free for inputs */
export const OUTPUT_PINS: number[] = [
  ...PINS.filter((p) => !p.inputCapable).map((p) => p.pin),
  ...PINS.filter((p) => p.inputCapable).map((p) => p.pin),
];

export interface CompileResult {
  image: Uint8Array;
  warnings: string[];
  placement: Record<string, string>; // node id -> resource name
}

export class CompileError extends Error {}

interface Placement {
  node: GraphNode;
  cell?: LutCell;
  pad?: IoPad;
}

/** OSC config: matrix source index + force-on / matrix-out-enable bits */
const OSC_DEFS = {
  osc0_2k: { src: 31, forceOn: OSC.OSC0_2KHZ.forceOnBit, outEn: OSC.OSC0_2KHZ.matrixOutEnableBit, label: '2.048kHz' },
  osc1_2m: { src: 30, forceOn: OSC.OSC1_2MHZ.forceOnBit, outEn: OSC.OSC1_2MHZ.matrixOutEnableBit, label: '2.048MHz' },
  osc2_25m: { src: 32, forceOn: OSC.OSC2_25MHZ.forceOnBit, outEn: OSC.OSC2_25MHZ.matrixOutEnableBit, label: '25MHz' },
} as const;
export const OSC_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(OSC_DEFS).map(([k, v]) => [k, v.label]),
);

function sourceIndex(p: Placement): number {
  if (p.node.type === 'vdd') return VDD;
  if (p.node.type === 'gnd') return GND;
  if (p.node.type === 'virt_in') {
    // I2C virtual inputs: VIRTUAL_0 = source 55 ... VIRTUAL_7 = source 48
    return 55 - (p.node.props.virtIndex ?? 0);
  }
  if (p.node.type === 'osc') return OSC_DEFS[p.node.props.osc ?? 'osc0_2k'].src;
  if (p.pad) {
    if (p.pad.matrixInputIndex < 0)
      throw new CompileError(`${p.pad.id} は出力専用ピンです (入力に使えません)`);
    return p.pad.matrixInputIndex;
  }
  if (p.cell) return OUTPUT_INDEX[p.cell.id];
  throw new CompileError(`no source for node ${p.node.id}`);
}

export function compile(graph: Graph): CompileResult {
  const warnings: string[] = [];
  const image = blankImage();
  const placement: Record<string, string> = {};

  // --- placement --------------------------------------------------------
  const placements = new Map<string, Placement>();
  const free = new Set(LUTS.map((l) => l.id));
  const take = (pref: string[], err: string): LutCell => {
    for (const id of pref) {
      if (free.has(id)) {
        free.delete(id);
        return LUTS.find((l) => l.id === id)!;
      }
    }
    throw new CompileError(err);
  };
  // preference orders: keep DFF-with-reset cells for dff nodes when possible
  const LUT2_PREF = ['LUT2_0', 'LUT2_1', 'LUT2_2', 'LUT2_3', 'LUT3_6',
    'LUT3_7', 'LUT3_8', 'LUT3_9', 'LUT3_10', 'LUT3_11', 'LUT3_12', 'LUT3_13',
    'LUT3_0', 'LUT3_1', 'LUT3_2', 'LUT3_3', 'LUT3_4', 'LUT3_5', 'LUT4_0'];
  const LUT3_PREF = LUT2_PREF.filter((id) => id.startsWith('LUT3') || id === 'LUT4_0');
  const DFF_PREF = ['LUT3_0', 'LUT3_1', 'LUT3_2', 'LUT3_3', 'LUT3_4', 'LUT3_5',
    'LUT3_7', 'LUT3_8', 'LUT3_9', 'LUT3_10', 'LUT3_11', 'LUT3_12', 'LUT3_13'];
  const usedPins = new Set<number>();
  const usedVirt = new Set<number>();

  for (const node of graph.nodes) {
    const p: Placement = { node };
    const name = node.label ?? node.id;
    switch (node.type) {
      case 'gpio_in':
      case 'gpio_out': {
        const pin = node.props.pin;
        if (pin == null) throw new CompileError(`${name}: ピン未指定`);
        if (usedPins.has(pin)) throw new CompileError(`ピン${pin}が重複しています`);
        usedPins.add(pin);
        const pad = IO_PADS.find((io) => io.tssopPin === pin);
        if (!pad) throw new CompileError(`ピン${pin}はGPIOではありません`);
        if (node.type === 'gpio_in' && pad.kind !== 'GPIO')
          throw new CompileError(`${name}: ピン${pin} (${pad.id}) は出力専用です`);
        p.pad = pad;
        placement[node.id] = pad.id;
        break;
      }
      case 'lut2':
        p.cell = take(LUT2_PREF, 'LUTリソースが不足しています');
        placement[node.id] = p.cell.id;
        break;
      case 'lut3':
        p.cell = take(LUT3_PREF, 'LUT3リソースが不足しています');
        placement[node.id] = p.cell.id;
        break;
      case 'lut4':
        p.cell = take(['LUT4_0'], 'LUT4は1個しかありません');
        placement[node.id] = p.cell.id;
        break;
      case 'dff':
        p.cell = take(DFF_PREF, 'DFFリソースが不足しています');
        placement[node.id] = p.cell.id;
        break;
      case 'virt_in': {
        const vi = node.props.virtIndex;
        if (vi == null || vi < 0 || vi > 7)
          throw new CompileError(`${name}: 仮想入力番号(0-7)が未指定です`);
        if (usedVirt.has(vi)) throw new CompileError(`仮想入力${vi}が重複しています`);
        usedVirt.add(vi);
        placement[node.id] = `VIRT${vi}`;
        break;
      }
      case 'osc':
        placement[node.id] = node.props.osc ?? 'osc0_2k';
        break;
      case 'vdd':
      case 'gnd':
        break;
    }
    placements.set(node.id, p);
  }

  // --- routing + encoding ----------------------------------------------
  const driverOf = (nodeId: string, port: string): number | null => {
    const e = graph.edges.find((ed) => ed.to.node === nodeId && ed.to.port === port);
    if (!e) return null;
    const src = placements.get(e.from.node);
    if (!src) throw new CompileError(`未知のノード参照: ${e.from.node}`);
    return sourceIndex(src);
  };

  for (const node of graph.nodes) {
    const p = placements.get(node.id)!;
    const name = node.label ?? node.id;
    switch (node.type) {
      case 'gpio_in': {
        const pad = p.pad!;
        // digital input with Schmitt trigger (input mode 01)
        if (pad.cfg.inputMode) setField(image, pad.cfg.inputMode, 0b01);
        break;
      }
      case 'osc': {
        const o = OSC_DEFS[node.props.osc ?? 'osc0_2k'];
        setBit(image, o.forceOn, 1);
        setBit(image, o.outEn, 1);
        break;
      }
      case 'gpio_out': {
        const pad = p.pad!;
        const src = driverOf(node.id, 'in0');
        if (src == null) {
          warnings.push(`${name}: 入力が未接続です`);
          break;
        }
        setField(image, pad.cfg.outputMode, 0b00); // push-pull 1x
        setField(image, pad.outSel, src);
        if (pad.oeKind === 'matrix' && pad.oeSel) {
          setField(image, pad.oeSel, VDD); // permanently driven
        } else if (pad.oeKind === 'register' && pad.cfg.oeRegisterBit != null) {
          setBit(image, pad.cfg.oeRegisterBit, 1);
        }
        break;
      }
      case 'lut2':
      case 'lut3':
      case 'lut4': {
        const cell = p.cell!;
        const nIn = Number(node.type[3]);
        let truth = node.props.truth ?? 0;
        // widen a small LUT placed in a bigger cell: unused inputs tied to
        // GND and the upper table halves replicated so their value is moot.
        let width = nIn;
        while (width < cell.nBits) {
          truth = truth | (truth << (1 << width));
          width++;
        }
        if (cell.dff) setBit(image, cell.dff.lutDffSelectBit, 0);
        setField(image, cell.truth, truth >>> 0);
        // input i is "don't care" if flipping it never changes the output
        const rawTruth = node.props.truth ?? 0;
        const dontCare = (i: number) => {
          for (let v = 0; v < 1 << nIn; v++) {
            if (((rawTruth >> v) & 1) !== ((rawTruth >> (v ^ (1 << i))) & 1)) return false;
          }
          return true;
        };
        cell.inputs.forEach((f, i) => {
          const src = i < nIn ? driverOf(node.id, `in${i}`) : GND;
          if (src == null) {
            if (!dontCare(i)) warnings.push(`${name}: in${i} が未接続 (GND扱い)`);
            setField(image, f, GND);
          } else {
            setField(image, f, src);
          }
        });
        break;
      }
      case 'dff': {
        const cell = p.cell!;
        const dff = cell.dff!;
        setBit(image, dff.lutDffSelectBit, 1);
        setBit(image, dff.dffLatchSelectBit, 0); // edge-triggered DFF
        setBit(image, dff.outputSelectBit, node.props.invertQ ? 1 : 0);
        setBit(image, dff.initialPolarityBit, 0); // powers up low
        if (dff.nRstNSetSelectBit != null) setBit(image, dff.nRstNSetSelectBit, 0); // pin = nRST
        const route = (f: { msb: number; lsb: number } | undefined, port: string, fallback: number, required: boolean) => {
          if (!f) return;
          const src = driverOf(node.id, port);
          if (src == null && required) warnings.push(`${name}: ${port} が未接続`);
          setField(image, f, src ?? fallback);
        };
        route(dff.d, 'd', GND, true);
        route(dff.clk, 'clk', GND, true);
        // rst input is active-low nRST on the chip; unconnected -> tied high
        route(dff.nRstNSet, 'rst', VDD, false);
        route(dff.nRst, 'rst', VDD, false);
        if (dff.nSet) setField(image, dff.nSet, VDD); // nSET inactive
        break;
      }
    }
  }

  return { image, warnings, placement };
}

// --- NVM verify mask ----------------------------------------------------
// ISP guide Table 4: bytes whose read-back may legitimately differ.
const IGNORE_BYTES = new Set<number>();
for (const b of [0x83, 0x8d, 0x9d, 0xc0, 0xc9, 0xe3, 0xe5]) IGNORE_BYTES.add(b);
for (let b = 0x68; b <= 0x6b; b++) IGNORE_BYTES.add(b);
for (let b = 0x73; b <= 0x7f; b++) IGNORE_BYTES.add(b);
for (let b = 0xcd; b <= 0xcf; b++) IGNORE_BYTES.add(b);
for (let b = 0xf0; b <= 0xff; b++) IGNORE_BYTES.add(b);
// firmware only writes pages 0-13; ignore the protection page too
for (let b = 0xe0; b <= 0xef; b++) IGNORE_BYTES.add(b);

export function verifyImage(expected: Uint8Array, readback: Uint8Array): number[] {
  const bad: number[] = [];
  for (let i = 0; i < 256; i++) {
    if (IGNORE_BYTES.has(i)) continue;
    if (expected[i] !== readback[i]) bad.push(i);
  }
  return bad;
}
