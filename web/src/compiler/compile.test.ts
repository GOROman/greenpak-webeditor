import { describe, expect, it } from 'vitest';
import { Graph, TRUTH } from '../model';
import { compile, verifyImage } from './slg46826';
import { PRESETS } from '../presets/presets74';

// Helper: read register bit B from the image (byte B>>3, bit B&7).
const bit = (img: Uint8Array, b: number) => (img[b >> 3] >> (b & 7)) & 1;
const field = (img: Uint8Array, msb: number, lsb: number) => {
  let v = 0;
  for (let i = msb; i >= lsb; i--) v = (v << 1) | bit(img, i);
  return v;
};

function nandGraph(): Graph {
  // IO3(pin16) & IO4(pin15) -> NAND -> IO5(pin14)
  return {
    nodes: [
      { id: 'a', type: 'gpio_in', x: 0, y: 0, props: { pin: 16 } },
      { id: 'b', type: 'gpio_in', x: 0, y: 0, props: { pin: 15 } },
      { id: 'g', type: 'lut2', x: 0, y: 0, props: { truth: TRUTH.NAND2 } },
      { id: 'y', type: 'gpio_out', x: 0, y: 0, props: { pin: 14 } },
    ],
    edges: [
      { id: 'e1', from: { node: 'a', port: 'out' }, to: { node: 'g', port: 'in0' } },
      { id: 'e2', from: { node: 'b', port: 'out' }, to: { node: 'g', port: 'in1' } },
      { id: 'e3', from: { node: 'g', port: 'out' }, to: { node: 'y', port: 'in0' } },
    ],
  };
}

describe('compile', () => {
  it('encodes a NAND on LUT2_0 with IO routing', () => {
    const { image, warnings } = compile(nandGraph());
    expect(warnings).toEqual([]);
    // LUT2_0 truth table [1155:1152] = NAND (0b0111)
    expect(field(image, 1155, 1152)).toBe(0b0111);
    // LUT2_0 stays in LUT mode (bit 1232 = 0)
    expect(bit(image, 1232)).toBe(0);
    // matrix out 0 (LUT2_0.IN0) <- IO3 input (source 4); out 1 <- IO4 (5)
    expect(field(image, 5, 0)).toBe(4);
    expect(field(image, 11, 6)).toBe(5);
    // IO5 output selector (matrix out 74) <- LUT2_0 out (source 14),
    // OE selector (out 75) <- VDD (63)
    expect(field(image, 6 * 74 + 5, 6 * 74)).toBe(14);
    expect(field(image, 6 * 75 + 5, 6 * 75)).toBe(63);
    // IO3/IO4 input mode = digital in with Schmitt (01)
    expect(field(image, 809, 808)).toBe(0b01);
    expect(field(image, 817, 816)).toBe(0b01);
    // I2C control code preserved at 0001 (byte 0xCA)
    expect(image[0xca]).toBe(0x01);
  });

  it('places a DFF on LUT3_0 in DFF mode with nRST tied high', () => {
    const g: Graph = {
      nodes: [
        { id: 'd', type: 'gpio_in', x: 0, y: 0, props: { pin: 16 } },
        { id: 'c', type: 'gpio_in', x: 0, y: 0, props: { pin: 15 } },
        { id: 'ff', type: 'dff', x: 0, y: 0, props: {} },
        { id: 'q', type: 'gpio_out', x: 0, y: 0, props: { pin: 19 } },
      ],
      edges: [
        { id: 'e1', from: { node: 'd', port: 'out' }, to: { node: 'ff', port: 'd' } },
        { id: 'e2', from: { node: 'c', port: 'out' }, to: { node: 'ff', port: 'clk' } },
        { id: 'e3', from: { node: 'ff', port: 'q' }, to: { node: 'q', port: 'in0' } },
      ],
    };
    const { image, placement } = compile(g);
    expect(placement['ff']).toBe('LUT3_0');
    expect(bit(image, 1236)).toBe(1); // DFF3 mode
    // DFF3: CLK = matrix out 8, D = out 9, nRST/nSET = out 10 (VDD = 63)
    expect(field(image, 6 * 8 + 5, 6 * 8)).toBe(5); // IO4 -> CLK
    expect(field(image, 6 * 9 + 5, 6 * 9)).toBe(4); // IO3 -> D
    expect(field(image, 6 * 10 + 5, 6 * 10)).toBe(63); // nRST inactive
    // IO0 (pin19, register OE) drives Q: out sel 67 <- DFF3 out (18), OE bit 783
    expect(field(image, 6 * 67 + 5, 6 * 67)).toBe(18);
    expect(bit(image, 783)).toBe(1);
  });

  it('widens a 2-input truth table into a 3-bit cell', () => {
    // occupy the three 2-bit LUT cells plus LUT2_3 and LUT3_6 so an AND
    // lands in an MF 3-bit cell
    const nodes: Graph['nodes'] = [];
    const edges: Graph['edges'] = [];
    for (let i = 0; i < 6; i++) {
      nodes.push({ id: `l${i}`, type: 'lut2', x: 0, y: 0, props: { truth: TRUTH.AND2 } });
    }
    const { image, placement } = compile({ nodes, edges });
    expect(placement['l5']).toBe('LUT3_7');
    // LUT3_7 truth [1351:1344]: AND2 (0b1000) replicated -> 0b10001000
    expect(field(image, 1351, 1344)).toBe(0b10001000);
  });

  it('rejects input on output-only pads and duplicate pins', () => {
    expect(() =>
      compile({
        nodes: [{ id: 'a', type: 'gpio_in', x: 0, y: 0, props: { pin: 11 } }],
        edges: [],
      }),
    ).toThrow(/出力専用/);
    expect(() =>
      compile({
        nodes: [
          { id: 'a', type: 'gpio_in', x: 0, y: 0, props: { pin: 16 } },
          { id: 'b', type: 'gpio_in', x: 0, y: 0, props: { pin: 16 } },
        ],
        edges: [],
      }),
    ).toThrow(/重複/);
  });

  it('compiles every 74-series preset without warnings', () => {
    for (const p of PRESETS) {
      const { warnings } = compile(p.build());
      expect(warnings, p.name).toEqual([]);
    }
  });

  it('routes I2C virtual inputs and enables the oscillator', () => {
    const g: Graph = {
      nodes: [
        { id: 'v', type: 'virt_in', x: 0, y: 0, props: { virtIndex: 2 } },
        { id: 'o', type: 'osc', x: 0, y: 0, props: { osc: 'osc0_2k' } },
        { id: 'y1', type: 'gpio_out', x: 0, y: 0, props: { pin: 14 } },
        { id: 'y2', type: 'gpio_out', x: 0, y: 0, props: { pin: 15 } },
      ],
      edges: [
        { id: 'e1', from: { node: 'v', port: 'out' }, to: { node: 'y1', port: 'in0' } },
        { id: 'e2', from: { node: 'o', port: 'out' }, to: { node: 'y2', port: 'in0' } },
      ],
    };
    const { image } = compile(g);
    // IO5 (pin14) out sel 74 <- VIRTUAL_2 = source 53; IO4 (pin15) out sel 72 <- OSC0 = 31
    expect(field(image, 6 * 74 + 5, 6 * 74)).toBe(53);
    expect(field(image, 6 * 72 + 5, 6 * 72)).toBe(31);
    // OSC0 force-on (1040) and matrix-out enable (1049)
    expect(bit(image, 1040)).toBe(1);
    expect(bit(image, 1049)).toBe(1);
  });

  it('verifyImage ignores the documented mask bytes', () => {
    const a = new Uint8Array(256);
    const b = new Uint8Array(256);
    b[0xe3] = 0xff; // ERSR
    b[0xf5] = 0xff; // service page
    expect(verifyImage(a, b)).toEqual([]);
    b[0x10] = 1;
    expect(verifyImage(a, b)).toEqual([0x10]);
  });
});
