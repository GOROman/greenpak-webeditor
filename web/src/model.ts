// Logic graph data model. This is what the editor edits, presets ship as,
// and the compiler consumes.

export type NodeType =
  | 'gpio_in'   // input pad -> matrix
  | 'gpio_out'  // matrix -> output pad
  | 'lut2'
  | 'lut3'
  | 'lut4'
  | 'dff'       // D flip-flop (dual-function macrocell in DFF mode)
  | 'virt_in'   // I2C virtual input (register byte 0x7A, toggled from the PC)
  | 'osc'       // internal oscillator routed to the matrix
  | 'vdd'       // constant 1
  | 'gnd';      // constant 0

export interface GraphNode {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  label?: string;
  props: {
    /** physical pin number on the SLG46826V-DIP module, for gpio_in/gpio_out */
    pin?: number;
    /** truth table for LUTs, bit i = output for input value i (LSB = all-low) */
    truth?: number;
    /** dff: use inverted output */
    invertQ?: boolean;
    /** gpio_in / virt_in / osc: simulated input level for the logic preview */
    value?: 0 | 1;
    /** virt_in: I2C virtual input index 0-7 */
    virtIndex?: number;
    /** osc: which internal oscillator */
    osc?: 'osc0_2k' | 'osc1_2m' | 'osc2_25m';
    /** LUT/DFF nodes: pin to a specific physical macrocell (undefined = auto) */
    cell?: string;
  };
}

export interface Port {
  node: string;
  /** 'out' | 'q' for outputs; 'in0'..'in3', 'd', 'clk', 'rst' for inputs */
  port: string;
}

export interface Edge {
  id: string;
  from: Port; // always an output port
  to: Port;   // always an input port
}

export interface Graph {
  nodes: GraphNode[];
  edges: Edge[];
}

export const NODE_DEFS: Record<
  NodeType,
  { title: string; inputs: string[]; outputs: string[] }
> = {
  gpio_in: { title: 'IN', inputs: [], outputs: ['out'] },
  gpio_out: { title: 'OUT', inputs: ['in0'], outputs: [] },
  virt_in: { title: 'I2C', inputs: [], outputs: ['out'] },
  osc: { title: 'OSC', inputs: [], outputs: ['out'] },
  lut2: { title: 'LUT2', inputs: ['in0', 'in1'], outputs: ['out'] },
  lut3: { title: 'LUT3', inputs: ['in0', 'in1', 'in2'], outputs: ['out'] },
  lut4: { title: 'LUT4', inputs: ['in0', 'in1', 'in2', 'in3'], outputs: ['out'] },
  dff: { title: 'DFF', inputs: ['d', 'clk', 'rst'], outputs: ['q'] },
  vdd: { title: 'VDD', inputs: [], outputs: ['out'] },
  gnd: { title: 'GND', inputs: [], outputs: ['out'] },
};

// Common truth tables (2-input; index bit1=in1, bit0=in0)
export const TRUTH = {
  AND2: 0b1000,
  OR2: 0b1110,
  NAND2: 0b0111,
  NOR2: 0b0001,
  XOR2: 0b0110,
  XNOR2: 0b1001,
  INV: 0b0101, // out = !in0, independent of in1
  BUF: 0b1010, // out = in0, independent of in1
} as const;

export function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}
