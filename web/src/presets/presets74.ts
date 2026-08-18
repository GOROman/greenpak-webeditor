// 74-series logic IC presets, expressed as editable node graphs.
// GPIO assignment uses AVAILABLE_PINS (physical DIP-module pin numbers) in
// order: inputs/outputs are assigned sequentially, labels carry the original
// 74xx pin names (1A, 1B, 1Y, ...).
import { Graph, GraphNode, TRUTH, newId } from '../model';
import { INPUT_PINS, OUTPUT_PINS } from '../compiler/slg46826';

/** sequential pin allocator honoring input-capability and no-reuse */
function pinAllocator() {
  const used = new Set<number>();
  const next = (pool: number[]): number => {
    const pin = pool.find((p) => !used.has(p));
    if (pin == null) throw new Error('プリセットに割り当てるピンが不足');
    used.add(pin);
    return pin;
  };
  return {
    input: () => next(INPUT_PINS),
    output: () => next(OUTPUT_PINS),
  };
}

interface GateSpec {
  name: string;
  truth: number;
  inputsPerGate: number;
  gates: number;
}

function gatePreset(spec: GateSpec): Graph {
  const g: Graph = { nodes: [], edges: [] };
  const pins = pinAllocator();
  const lutType = spec.inputsPerGate >= 3 ? 'lut3' : 'lut2';
  for (let i = 0; i < spec.gates; i++) {
    const y = 40 + i * (spec.inputsPerGate >= 3 ? 160 : 110);
    const lut: GraphNode = {
      id: newId(lutType),
      type: lutType,
      x: 260,
      y: y + 10,
      props: { truth: spec.truth },
      label: `${spec.name} #${i + 1}`,
    };
    g.nodes.push(lut);
    const inNames = ['A', 'B', 'C'].slice(0, spec.inputsPerGate);
    inNames.forEach((nm, j) => {
      const inn: GraphNode = {
        id: newId('in'),
        type: 'gpio_in',
        x: 60,
        y: y + j * 50,
        props: { pin: pins.input() },
        label: `${i + 1}${nm}`,
      };
      g.nodes.push(inn);
      g.edges.push({
        id: newId('e'),
        from: { node: inn.id, port: 'out' },
        to: { node: lut.id, port: `in${j}` },
      });
    });
    const out: GraphNode = {
      id: newId('out'),
      type: 'gpio_out',
      x: 440,
      y: y + 10,
      props: { pin: pins.output() },
      label: `${i + 1}Y`,
    };
    g.nodes.push(out);
    g.edges.push({
      id: newId('e'),
      from: { node: lut.id, port: 'out' },
      to: { node: out.id, port: 'in0' },
    });
  }
  return g;
}

function preset7404(): Graph {
  // hex inverter
  const g: Graph = { nodes: [], edges: [] };
  const pins = pinAllocator();
  for (let i = 0; i < 6; i++) {
    const y = 40 + i * 70;
    const inn: GraphNode = {
      id: newId('in'), type: 'gpio_in', x: 60, y,
      props: { pin: pins.input() }, label: `${i + 1}A`,
    };
    const lut: GraphNode = {
      id: newId('lut2'), type: 'lut2', x: 260, y,
      props: { truth: TRUTH.INV }, label: `INV #${i + 1}`,
    };
    const out: GraphNode = {
      id: newId('out'), type: 'gpio_out', x: 440, y,
      props: { pin: pins.output() }, label: `${i + 1}Y`,
    };
    g.nodes.push(inn, lut, out);
    g.edges.push(
      { id: newId('e'), from: { node: inn.id, port: 'out' }, to: { node: lut.id, port: 'in0' } },
      { id: newId('e'), from: { node: lut.id, port: 'out' }, to: { node: out.id, port: 'in0' } },
    );
  }
  return g;
}

function preset7474(): Graph {
  // dual D-type flip-flop with async reset (set omitted: nRST only on chip DFFs)
  const g: Graph = { nodes: [], edges: [] };
  const pins = pinAllocator();
  for (let i = 0; i < 2; i++) {
    const y = 40 + i * 160;
    const mk = (label: string, dy: number): GraphNode => {
      const n: GraphNode = {
        id: newId('in'), type: 'gpio_in', x: 60, y: y + dy,
        props: { pin: pins.input() }, label,
      };
      g.nodes.push(n);
      return n;
    };
    const d = mk(`${i + 1}D`, 0);
    const clk = mk(`${i + 1}CLK`, 50);
    const rst = mk(`${i + 1}CLR`, 100);
    const ff: GraphNode = {
      id: newId('dff'), type: 'dff', x: 260, y: y + 20, props: {}, label: `DFF #${i + 1}`,
    };
    const q: GraphNode = {
      id: newId('out'), type: 'gpio_out', x: 440, y: y + 20,
      props: { pin: pins.output() }, label: `${i + 1}Q`,
    };
    g.nodes.push(ff, q);
    g.edges.push(
      { id: newId('e'), from: { node: d.id, port: 'out' }, to: { node: ff.id, port: 'd' } },
      { id: newId('e'), from: { node: clk.id, port: 'out' }, to: { node: ff.id, port: 'clk' } },
      { id: newId('e'), from: { node: rst.id, port: 'out' }, to: { node: ff.id, port: 'rst' } },
      { id: newId('e'), from: { node: ff.id, port: 'q' }, to: { node: q.id, port: 'in0' } },
    );
  }
  return g;
}

function preset74138(): Graph {
  // 3-to-8 line decoder, active-low outputs (enables omitted)
  const g: Graph = { nodes: [], edges: [] };
  const pins = pinAllocator();
  const ins = ['A', 'B', 'C'].map((nm, j) => {
    const n: GraphNode = {
      id: newId('in'), type: 'gpio_in', x: 60, y: 60 + j * 80,
      props: { pin: pins.input() }, label: nm,
    };
    g.nodes.push(n);
    return n;
  });
  for (let o = 0; o < 8; o++) {
    const lut: GraphNode = {
      id: newId('lut3'), type: 'lut3', x: 280, y: 40 + o * 90,
      props: { truth: 0xff ^ (1 << o) }, label: `/Y${o}`,
    };
    const out: GraphNode = {
      id: newId('out'), type: 'gpio_out', x: 460, y: 40 + o * 90,
      props: { pin: pins.output() }, label: `Y${o}`,
    };
    g.nodes.push(lut, out);
    ins.forEach((inn, j) =>
      g.edges.push({
        id: newId('e'), from: { node: inn.id, port: 'out' }, to: { node: lut.id, port: `in${j}` },
      }),
    );
    g.edges.push({
      id: newId('e'), from: { node: lut.id, port: 'out' }, to: { node: out.id, port: 'in0' },
    });
  }
  return g;
}

function preset74157(): Graph {
  // quad 2-to-1 selector: Y = S ? B : A  (truth 0xCA on in0=A, in1=B, in2=S)
  const g: Graph = { nodes: [], edges: [] };
  const pins = pinAllocator();
  const sel: GraphNode = {
    id: newId('in'), type: 'gpio_in', x: 60, y: 40,
    props: { pin: pins.input() }, label: 'S',
  };
  g.nodes.push(sel);
  for (let i = 0; i < 4; i++) {
    const y = 120 + i * 140;
    const a: GraphNode = {
      id: newId('in'), type: 'gpio_in', x: 60, y,
      props: { pin: pins.input() }, label: `${i + 1}A`,
    };
    const b: GraphNode = {
      id: newId('in'), type: 'gpio_in', x: 60, y: y + 60,
      props: { pin: pins.input() }, label: `${i + 1}B`,
    };
    const lut: GraphNode = {
      id: newId('lut3'), type: 'lut3', x: 280, y: y + 20,
      props: { truth: 0xca }, label: `MUX #${i + 1}`,
    };
    const out: GraphNode = {
      id: newId('out'), type: 'gpio_out', x: 460, y: y + 20,
      props: { pin: pins.output() }, label: `${i + 1}Y`,
    };
    g.nodes.push(a, b, lut, out);
    g.edges.push(
      { id: newId('e'), from: { node: a.id, port: 'out' }, to: { node: lut.id, port: 'in0' } },
      { id: newId('e'), from: { node: b.id, port: 'out' }, to: { node: lut.id, port: 'in1' } },
      { id: newId('e'), from: { node: sel.id, port: 'out' }, to: { node: lut.id, port: 'in2' } },
      { id: newId('e'), from: { node: lut.id, port: 'out' }, to: { node: out.id, port: 'in0' } },
    );
  }
  return g;
}

function preset74393(): Graph {
  // 4-bit binary ripple counter (one half of a 74393).
  // Each stage: DFF in nQ-output mode with D fed back from its own output
  // (toggle FF); the next stage clocks on that nQ rising edge (= Q falling,
  // standard ripple carry). A NOT gate recovers true Q for the output pin.
  // /CLR is the chip's active-low async reset.
  const g: Graph = { nodes: [], edges: [] };
  const pins = pinAllocator();
  const clk: GraphNode = {
    id: newId('in'), type: 'gpio_in', x: 60, y: 60,
    props: { pin: pins.input() }, label: 'CLK',
  };
  const nclr: GraphNode = {
    id: newId('in'), type: 'gpio_in', x: 60, y: 140,
    props: { pin: pins.input(), value: 1 }, label: '/CLR',
  };
  g.nodes.push(clk, nclr);
  let carry = clk; // node whose output clocks the next stage
  for (let i = 0; i < 4; i++) {
    const y = 60 + i * 140;
    const ff: GraphNode = {
      id: newId('dff'), type: 'dff', x: 280, y,
      props: { invertQ: true }, label: `FF${i} (nQ)`,
    };
    const inv: GraphNode = {
      id: newId('lut2'), type: 'lut2', x: 460, y,
      props: { truth: TRUTH.INV }, label: `Q${i}`,
    };
    const out: GraphNode = {
      id: newId('out'), type: 'gpio_out', x: 640, y,
      props: { pin: pins.output() }, label: `Q${i}`,
    };
    g.nodes.push(ff, inv, out);
    g.edges.push(
      { id: newId('e'), from: { node: carry.id, port: carry.type === 'dff' ? 'q' : 'out' }, to: { node: ff.id, port: 'clk' } },
      { id: newId('e'), from: { node: ff.id, port: 'q' }, to: { node: ff.id, port: 'd' } },
      { id: newId('e'), from: { node: nclr.id, port: 'out' }, to: { node: ff.id, port: 'rst' } },
      { id: newId('e'), from: { node: ff.id, port: 'q' }, to: { node: inv.id, port: 'in0' } },
      { id: newId('e'), from: { node: inv.id, port: 'out' }, to: { node: out.id, port: 'in0' } },
    );
    carry = ff;
  }
  return g;
}

function presetAddrDec4(addr = 0xa): Graph {
  // 4-bit address decoder on the single LUT4: Y goes high when A3:A0 == addr,
  // /Y is the active-low version. Change the LUT truth table to change the
  // decoded address (truth = 1 << addr).
  const g: Graph = { nodes: [], edges: [] };
  const pins = pinAllocator();
  const lut: GraphNode = {
    id: newId('lut4'), type: 'lut4', x: 280, y: 100,
    props: { truth: 1 << addr }, label: `ADDR=0x${addr.toString(16).toUpperCase()}`,
  };
  g.nodes.push(lut);
  for (let i = 0; i < 4; i++) {
    const a: GraphNode = {
      id: newId('in'), type: 'gpio_in', x: 60, y: 40 + i * 80,
      props: { pin: pins.input() }, label: `A${i}`,
    };
    g.nodes.push(a);
    g.edges.push({
      id: newId('e'), from: { node: a.id, port: 'out' }, to: { node: lut.id, port: `in${i}` },
    });
  }
  const y: GraphNode = {
    id: newId('out'), type: 'gpio_out', x: 640, y: 80,
    props: { pin: pins.output() }, label: 'Y',
  };
  const inv: GraphNode = {
    id: newId('lut2'), type: 'lut2', x: 460, y: 180,
    props: { truth: TRUTH.INV }, label: 'NOT',
  };
  const ny: GraphNode = {
    id: newId('out'), type: 'gpio_out', x: 640, y: 180,
    props: { pin: pins.output() }, label: '/Y',
  };
  g.nodes.push(y, inv, ny);
  g.edges.push(
    { id: newId('e'), from: { node: lut.id, port: 'out' }, to: { node: y.id, port: 'in0' } },
    { id: newId('e'), from: { node: lut.id, port: 'out' }, to: { node: inv.id, port: 'in0' } },
    { id: newId('e'), from: { node: inv.id, port: 'out' }, to: { node: ny.id, port: 'in0' } },
  );
  return g;
}

export const PRESETS: { id: string; name: string; build: () => Graph }[] = [
  { id: '7400', name: '7400 Quad NAND', build: () => gatePreset({ name: 'NAND', truth: TRUTH.NAND2, inputsPerGate: 2, gates: 4 }) },
  { id: '7402', name: '7402 Quad NOR', build: () => gatePreset({ name: 'NOR', truth: TRUTH.NOR2, inputsPerGate: 2, gates: 4 }) },
  { id: '7404', name: '7404 Hex Inverter', build: preset7404 },
  { id: '7408', name: '7408 Quad AND', build: () => gatePreset({ name: 'AND', truth: TRUTH.AND2, inputsPerGate: 2, gates: 4 }) },
  { id: '7432', name: '7432 Quad OR', build: () => gatePreset({ name: 'OR', truth: TRUTH.OR2, inputsPerGate: 2, gates: 4 }) },
  { id: '7486', name: '7486 Quad XOR', build: () => gatePreset({ name: 'XOR', truth: TRUTH.XOR2, inputsPerGate: 2, gates: 4 }) },
  { id: '7410', name: '7410 Triple 3-NAND', build: () => gatePreset({ name: 'NAND3', truth: 0x7f, inputsPerGate: 3, gates: 3 }) },
  { id: '7474', name: '7474 Dual D-FF', build: preset7474 },
  { id: '74138', name: '74138 3-to-8 Decoder', build: preset74138 },
  { id: '74157', name: '74157 Quad 2:1 MUX', build: preset74157 },
  { id: '74393', name: '74393 4bit Counter', build: preset74393 },
  { id: 'addrdec4', name: 'アドレスデコーダ 4bit (=0xA)', build: () => presetAddrDec4(0xa) },
];
