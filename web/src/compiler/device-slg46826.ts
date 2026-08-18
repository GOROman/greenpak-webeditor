/**
 * SLG46826 (Renesas GreenPAK) device database.
 *
 * Source: SLG46826 Datasheet, Revision 3.18, 27-Feb-2023 (CFR0011-120-00), 187 pages.
 * Downloaded from https://akizukidenshi.com/goodsaffix/SLG46826.pdf
 *
 * Bit addressing convention (datasheet Ch.6 / Ch.18):
 *   The configuration space is 2048 bits ("register bits" [0..2047]).
 *   Byte N of the 256-byte NVM/register image holds bits [8N+7 : 8N], LSB-first,
 *   i.e. register bit B lives in byte (B >> 3), bit position (B & 7).
 *
 * Key datasheet locations (page numbers of Rev 3.18 PDF):
 *   - Pinout STQFN-20 / TSSOP-20 ............... pp. 8-9   (Table 1: pp. 9-12)
 *   - IO structures (matrix-OE vs register-OE) . pp. 34-38 (Figs 3-6)
 *   - Connection Matrix ........................ p. 42
 *   - Table 21 Matrix Input Table .............. pp. 43-44
 *   - Table 22 Matrix Output Table ............. pp. 44-47
 *   - Table 23 Virtual Inputs .................. p. 48
 *   - 2-bit LUT/DFF macrocells ................. pp. 49-53 (truth tables p. 51)
 *   - 3-bit LUT/DFF macrocells ................. pp. 54-60 (truth tables p. 58)
 *   - Pipe delay / ripple counter .............. pp. 61-64
 *   - Multi-function (LUT7-13 / DFF10-16) ...... pp. 66-74 (truth tables p. 74)
 *   - 4-bit LUT0 / DFF9 / CNT0 ................. pp. 83-85 (truth table p. 85)
 *   - I2C addressing (control code) ............ p. 119
 *   - Table 59 Register Map .................... pp. 135-173
 */

export interface BitField {
  /** Register-bit index of the MSB (inclusive). */
  msb: number;
  /** Register-bit index of the LSB (inclusive). */
  lsb: number;
}

/** Width of a field in bits. */
export function fieldWidth(f: BitField): number {
  return f.msb - f.lsb + 1;
}

/**
 * The 6-bit selector field of connection-matrix output N occupies register
 * bits [6N+5 : 6N]. (Table 22, pp. 44-47; also Table 59 "Matrix Output"
 * rows, pp. 135-139. "For each Address, the two most significant bits are
 * unused" refers to the 8-bit-aligned view; the packed field is 6 bits.)
 */
export function matrixOutField(n: number): BitField {
  return { msb: 6 * n + 5, lsb: 6 * n };
}

// ---------------------------------------------------------------------------
// 1. Matrix input table (Table 21, pp. 43-44): 6-bit source index -> signal.
// ---------------------------------------------------------------------------
export const MATRIX_SOURCES: Record<string, number> = {
  GND: 0, // "GND" (tie low)
  IO0_IN: 1, // IO0 Digital Input
  IO1_IN: 2,
  IO2_IN: 3,
  IO3_IN: 4,
  IO4_IN: 5,
  IO5_IN: 6,
  IO8_IN: 7, // NOTE: index 7 is IO8 (IO6/IO7 are output-only GPOs, no matrix input)
  IO9_IN: 8,
  IO10_IN: 9,
  IO11_IN: 10,
  IO12_IN: 11,
  IO13_IN: 12,
  IO14_IN: 13,
  LUT2_0_DFF0_OUT: 14,
  LUT2_1_DFF1_OUT: 15,
  LUT2_2_DFF2_OUT: 16,
  LUT2_3_PGEN_OUT: 17,
  LUT3_0_DFF3_OUT: 18,
  LUT3_1_DFF4_OUT: 19,
  LUT3_2_DFF5_OUT: 20,
  LUT3_3_DFF6_OUT: 21,
  LUT3_4_DFF7_OUT: 22,
  LUT3_5_DFF8_OUT: 23,
  LUT3_6_PIPEDLY_RIPP_CNT_OUT0: 24,
  PIPEDLY_RIPP_CNT_OUT1: 25,
  RIPP_CNT_OUT2: 26,
  EDET_FILTER_OUT: 27,
  PROG_DLY_EDET_OUT: 28,
  MF1_DLY_CNT_OUT: 29, // MULTFUNC_8BIT_1: CNT/DLY1 output
  CKOSC1_MATRIX: 30, // OSC1 (2.048 MHz) matrix output
  CKOSC0_MATRIX: 31, // OSC0 (2.048 kHz) matrix output
  CKOSC2_MATRIX: 32, // OSC2 (25 MHz) matrix output
  MF2_DLY_CNT_OUT: 33,
  MF3_DLY_CNT_OUT: 34,
  MF4_DLY_CNT_OUT: 35,
  MF5_DLY_CNT_OUT: 36,
  MF6_DLY_CNT_OUT: 37,
  MF7_DLY_CNT_OUT: 38,
  MF0_LUT4_0_DFF9_OUT: 39, // MULTFUNC_16BIT_0: LUT_DFF_OUT (4-bit LUT0 / DFF9)
  MF1_LUT3_7_DFF10_OUT: 40,
  MF2_LUT3_8_DFF11_OUT: 41,
  MF3_LUT3_9_DFF12_OUT: 42,
  MF4_LUT3_10_DFF13_OUT: 43,
  MF5_LUT3_11_DFF14_OUT: 44,
  MF6_LUT3_12_DFF15_OUT: 45,
  MF7_LUT3_13_DFF16_OUT: 46,
  MF0_DLY_CNT_OUT: 47, // MULTFUNC_16BIT_0: CNT/DLY0 output
  I2C_VIRTUAL_7: 48, // driven by register bit [976] (Table 23, p. 48; I2C byte 0x7A)
  I2C_VIRTUAL_6: 49, // [977]
  I2C_VIRTUAL_5: 50, // [978]
  I2C_VIRTUAL_4: 51, // [979]
  I2C_VIRTUAL_3: 52, // [980]
  I2C_VIRTUAL_2: 53, // [981]
  I2C_VIRTUAL_1: 54, // [982]
  I2C_VIRTUAL_0: 55, // [983]
  ACMP0H_OUT: 56,
  ACMP1H_OUT: 57,
  ACMP2L_OUT: 58,
  ACMP3L_OUT: 59,
  CKOSC1_MATRIX_2ND: 60, // 2nd OSC1 matrix output (own divider, bits [1058:1056])
  CKOSC0_MATRIX_2ND: 61, // 2nd OSC0 matrix output (own divider, bits [1061:1059])
  POR_OUT: 62, // POR CORE
  VDD: 63, // tie high
};

// ---------------------------------------------------------------------------
// 2. Matrix output (destination) table (Table 22, pp. 44-47).
//    Every destination is a 6-bit selector at bits [6N+5 : 6N].
//    Names give both the LUT-mode and the DFF/CNT-mode meaning.
// ---------------------------------------------------------------------------
export interface MatrixDest {
  n: number; // matrix output number
  name: string;
  field: BitField;
}

function dest(n: number, name: string): MatrixDest {
  return { n, name, field: matrixOutField(n) };
}

export const MATRIX_DESTS: MatrixDest[] = [
  // --- 2-bit LUT / DFF macrocells (Table 22 p.44, Figs 14-16 pp. 49-50) ---
  dest(0, "LUT2_0.IN0 / DFF0.CLK"),
  dest(1, "LUT2_0.IN1 / DFF0.D"),
  dest(2, "LUT2_3.IN0 / PGEN.CLK"),
  dest(3, "LUT2_3.IN1 / PGEN.nRST"),
  dest(4, "LUT2_1.IN0 / DFF1.CLK"),
  dest(5, "LUT2_1.IN1 / DFF1.D"),
  dest(6, "LUT2_2.IN0 / DFF2.CLK"),
  dest(7, "LUT2_2.IN1 / DFF2.D"),
  // --- 3-bit LUT / DFF with set/reset (Table 22 pp. 44-45, Figs 20-25) ---
  dest(8, "LUT3_0.IN0 / DFF3.CLK"),
  dest(9, "LUT3_0.IN1 / DFF3.D"),
  dest(10, "LUT3_0.IN2 / DFF3.nRST_nSET"),
  dest(11, "LUT3_1.IN0 / DFF4.CLK"),
  dest(12, "LUT3_1.IN1 / DFF4.D"),
  dest(13, "LUT3_1.IN2 / DFF4.nRST_nSET"),
  dest(14, "LUT3_2.IN0 / DFF5.CLK"),
  dest(15, "LUT3_2.IN1 / DFF5.D"),
  dest(16, "LUT3_2.IN2 / DFF5.nRST_nSET"),
  dest(17, "LUT3_3.IN0 / DFF6.CLK"),
  dest(18, "LUT3_3.IN1 / DFF6.D"),
  dest(19, "LUT3_3.IN2 / DFF6.nRST_nSET"),
  dest(20, "LUT3_4.IN0 / DFF7.CLK"),
  dest(21, "LUT3_4.IN1 / DFF7.D"),
  dest(22, "LUT3_4.IN2 / DFF7.nRST_nSET"),
  dest(23, "LUT3_5.IN0 / DFF8.CLK"),
  dest(24, "LUT3_5.IN1 / DFF8.D"),
  dest(25, "LUT3_5.IN2 / DFF8.nRST_nSET"),
  // --- 3-bit LUT6 / pipe delay / ripple counter ---
  dest(26, "LUT3_6.IN0 / PIPEDLY.IN / RIPPCNT.UP"),
  dest(27, "LUT3_6.IN1 / PIPEDLY.nRST / RIPPCNT.STB"),
  dest(28, "LUT3_6.IN2 / PIPEDLY_RIPPCNT.CLK"),
  dest(29, "Reserved"),
  // --- Multi-function 16-bit macrocell (4-bit LUT0/DFF9/CNT0, Fig 51 p.84) ---
  dest(30, "MF0: LUT4_0.IN0 / DFF9.CLK / CNTDLY0.nRST_SET_in"),
  dest(31, "MF0: LUT4_0.IN1 / DFF9.nRST / CNTDLY0.extclk"),
  dest(32, "MF0: LUT4_0.IN2 / DFF9.nSET / FSM0.KEEP / CNTDLY0.extclk"),
  dest(33, "MF0: LUT4_0.IN3 / DFF9.D / FSM0.UP"),
  // --- Multi-function 8-bit macrocells 1..7 (Figs 31-37, pp. 67-73) ---
  dest(34, "MF1: LUT3_7.IN0 / DFF10.CLK / CNTDLY1.in"),
  dest(35, "MF1: LUT3_7.IN1 / DFF10.nRST_nSET / CNTDLY1.extclk"),
  dest(36, "MF1: LUT3_7.IN2 / DFF10.D / CNTDLY1.in"),
  dest(37, "MF2: LUT3_8.IN0 / DFF11.CLK / CNTDLY2.in"),
  dest(38, "MF2: LUT3_8.IN1 / DFF11.nRST_nSET / CNTDLY2.extclk"),
  dest(39, "MF2: LUT3_8.IN2 / DFF11.D / CNTDLY2.in"),
  dest(40, "MF3: LUT3_9.IN0 / DFF12.CLK / CNTDLY3.in"),
  dest(41, "MF3: LUT3_9.IN1 / DFF12.nRST_nSET / CNTDLY3.extclk"),
  dest(42, "MF3: LUT3_9.IN2 / DFF12.D / CNTDLY3.in"),
  dest(43, "MF4: LUT3_10.IN0 / DFF13.CLK / CNTDLY4.in"),
  dest(44, "MF4: LUT3_10.IN1 / DFF13.nRST_nSET / CNTDLY4.extclk"),
  dest(45, "MF4: LUT3_10.IN2 / DFF13.D / CNTDLY4.in"),
  dest(46, "MF5: LUT3_11.IN0 / DFF14.CLK / CNTDLY5.in"),
  dest(47, "MF5: LUT3_11.IN1 / DFF14.nRST_nSET / CNTDLY5.extclk"),
  dest(48, "MF5: LUT3_11.IN2 / DFF14.D / CNTDLY5.in"),
  dest(49, "MF6: LUT3_12.IN0 / DFF15.CLK / CNTDLY6.in"),
  dest(50, "MF6: LUT3_12.IN1 / DFF15.nRST_nSET / CNTDLY6.extclk"),
  dest(51, "MF6: LUT3_12.IN2 / DFF15.D / CNTDLY6.in"),
  dest(52, "MF7: LUT3_13.IN0 / DFF16.CLK / CNTDLY7.in"),
  dest(53, "MF7: LUT3_13.IN1 / DFF16.nRST_nSET / CNTDLY7.extclk"),
  dest(54, "MF7: LUT3_13.IN2 / DFF16.D / CNTDLY7.in"),
  // --- misc analog / clock enables ---
  dest(55, "Filter/EdgeDetect input"),
  dest(56, "ProgDelay/EdgeDetect input"),
  dest(57, "OSC2 ENABLE from matrix"),
  dest(58, "OSC0 ENABLE from matrix"),
  dest(59, "OSC1 ENABLE from matrix"),
  dest(60, "TempSensor+Vref PD from matrix"),
  dest(61, "BG power-down from matrix"),
  // UNVERIFIED: Table 22 (p. 46) labels outputs 62-65 as "PWR UP of
  // ACMP0H/1H/2L/3L from matrix", but Table 59 (p. 138) labels 62/63
  // Reserved and 64/65 "PWR UP of ACMP0L/ACMP1L". The two tables conflict;
  // matrix outs 62-65 are not needed for pure-digital designs.
  dest(62, "ACMP power-up (see UNVERIFIED note)"),
  dest(63, "ACMP power-up (see UNVERIFIED note)"),
  dest(64, "ACMP power-up (see UNVERIFIED note)"),
  dest(65, "ACMP power-up (see UNVERIFIED note)"),
  dest(66, "Reserved"),
  // --- IO pad output / OE selectors (Table 22 pp. 46-47) ---
  dest(67, "IO0 Digital Output"),
  dest(68, "IO1 Digital Output"),
  dest(69, "IO1 Digital Output OE"),
  dest(70, "IO2 Digital Output"),
  dest(71, "IO3 Digital Output"),
  dest(72, "IO4 Digital Output"),
  dest(73, "IO4 Digital Output OE"),
  dest(74, "IO5 Digital Output"),
  dest(75, "IO5 Digital Output OE"),
  dest(76, "IO6 Digital Output"),
  dest(77, "IO7 Digital Output"),
  dest(78, "IO8 Digital Output"),
  dest(79, "IO8 Digital Output OE"),
  dest(80, "IO9 Digital Output"),
  dest(81, "IO9 Digital Output OE"),
  dest(82, "IO10 Digital Output"),
  dest(83, "IO10 Digital Output OE"),
  dest(84, "IO11 Digital Output"),
  dest(85, "IO11 Digital Output OE"),
  dest(86, "IO12 Digital Output"),
  dest(87, "IO12 Digital Output OE"),
  dest(88, "IO13 Digital Output"),
  dest(89, "IO13 Digital Output OE"),
  dest(90, "IO14 Digital Output"),
  dest(91, "IO14 Digital Output OE"),
  dest(92, "Reserved"),
  dest(93, "Reserved"),
  dest(94, "Reserved"), // Table 22 says "Matrix OUT 94"; Table 59 (p.139) says Reserved
  dest(95, "Reserved"), // Table 22 says "Matrix OUT 95"; Table 59 says Reserved
];

// ---------------------------------------------------------------------------
// 3. LUT / DFF macrocells.
// ---------------------------------------------------------------------------
export interface DffOptions {
  /**
   * Bit that switches the whole macrocell from LUT to DFF/other mode.
   * 0 = LUT, 1 = DFF (or PGen for LUT2_3). For the 8 multi-function
   * macrocells this is the "LUT/DFF Sel" bit from Figures 31-37/51; the
   * full multi-bit mode fields are in MF_MODE_FIELDS below.
   */
  lutDffSelectBit: number;
  /** 0 = DFF (edge triggered), 1 = LATCH (transparent when CLK low). */
  dffLatchSelectBit: number;
  /** 0 = Q output, 1 = nQ (QB) output. */
  outputSelectBit: number;
  /** 0 = initial Low, 1 = initial High (state after POR). */
  initialPolarityBit: number;
  /**
   * For cells with a set/reset input: 0 = matrix pin acts as nRST,
   * 1 = matrix pin acts as nSET. undefined for DFF0-2 (no set/reset)
   * and DFF9 (has dedicated nSET and nRST matrix inputs instead).
   */
  nRstNSetSelectBit?: number;
  /** DFF-mode matrix-output selector fields. */
  d: BitField;
  clk: BitField;
  nRstNSet?: BitField; // shared nRST/nSET pin (polarity by nRstNSetSelectBit)
  nRst?: BitField; // DFF9 only
  nSet?: BitField; // DFF9 only
}

export interface LutCell {
  id: string;
  nBits: 2 | 3 | 4;
  /**
   * Truth-table register bits, LSB = output for all-inputs-0.
   * Truth bit for input vector v (IN0 = bit0 of v) lives at truth.lsb + v.
   * NOTE for dual-function cells: in DFF mode the top bits of this same
   * register are repurposed as the DFF option bits (see dff.* below), so a
   * cell is either a LUT or a DFF, never both (datasheet note p. 73).
   */
  truth: BitField;
  /** LUT-mode input selector fields, index 0 = IN0. */
  inputs: BitField[];
  dff?: DffOptions;
  /** Which macrocell group this belongs to. */
  group: "combi2" | "combi2pgen" | "combi3" | "pipedelay" | "mf8" | "mf16";
}

export const LUTS: LutCell[] = [
  // ---- 2-bit LUT / DFF macrocells (pp. 49-51, Table 59 bytes 0x90-0x91) ----
  {
    id: "LUT2_0", // Fig 14 p. 49, Table 24 p. 51
    nBits: 2,
    truth: { msb: 1155, lsb: 1152 },
    inputs: [matrixOutField(0), matrixOutField(1)],
    group: "combi2",
    dff: {
      lutDffSelectBit: 1232, // Table 59 byte 0x9A p. 155: 0=LUT2_0, 1=DFF0
      dffLatchSelectBit: 1155, // Table 59 byte 0x90 p. 152
      outputSelectBit: 1154,
      initialPolarityBit: 1153,
      clk: matrixOutField(0),
      d: matrixOutField(1),
    },
  },
  {
    id: "LUT2_1", // Fig 15 p. 50, Table 25 p. 51
    nBits: 2,
    truth: { msb: 1159, lsb: 1156 },
    inputs: [matrixOutField(4), matrixOutField(5)],
    group: "combi2",
    dff: {
      lutDffSelectBit: 1233,
      dffLatchSelectBit: 1159,
      outputSelectBit: 1158,
      initialPolarityBit: 1157,
      clk: matrixOutField(4),
      d: matrixOutField(5),
    },
  },
  {
    id: "LUT2_2", // Fig 16 p. 50, Table 26 p. 51
    nBits: 2,
    truth: { msb: 1163, lsb: 1160 },
    inputs: [matrixOutField(6), matrixOutField(7)],
    group: "combi2",
    dff: {
      lutDffSelectBit: 1234,
      dffLatchSelectBit: 1163,
      outputSelectBit: 1162,
      initialPolarityBit: 1161,
      clk: matrixOutField(6),
      d: matrixOutField(7),
    },
  },
  {
    id: "LUT2_3", // Fig 18 p. 53, Table 28 p. 54 -- alternate function is PGen, not DFF
    nBits: 2,
    truth: { msb: 1167, lsb: 1164 }, // in PGen mode: pattern-size counter data [3:0]
    inputs: [matrixOutField(2), matrixOutField(3)],
    group: "combi2pgen",
    // PGen: select bit 1235 (0=LUT2_3, 1=PGen); PGen data [15:0] = bits
    // [1183:1168]; CLK = matrix out 2, nRST = matrix out 3.
  },
  // ---- 3-bit LUT / DFF-with-set-reset macrocells (pp. 54-60, tables p. 58) ----
  {
    id: "LUT3_0", // Fig 20 p. 55, Table 30 p. 58, setting byte 0x94 p. 153
    nBits: 3,
    truth: { msb: 1191, lsb: 1184 },
    inputs: [matrixOutField(8), matrixOutField(9), matrixOutField(10)],
    group: "combi3",
    dff: {
      lutDffSelectBit: 1236, // byte 0x9A p. 155
      dffLatchSelectBit: 1191,
      outputSelectBit: 1190,
      nRstNSetSelectBit: 1189,
      initialPolarityBit: 1188,
      clk: matrixOutField(8),
      d: matrixOutField(9),
      nRstNSet: matrixOutField(10),
      // Extra: DFF3 has two internal DFF stages; bit [1237]
      // (DFF3_SECONDQ_Sel) picks Q of first (0) or second (1) DFF
      // (falling-edge output update). See p. 54 and byte 0x9A.
    },
  },
  {
    id: "LUT3_1", // Fig 21 p. 55, Table 31 p. 58, setting byte 0x95
    nBits: 3,
    truth: { msb: 1199, lsb: 1192 },
    inputs: [matrixOutField(11), matrixOutField(12), matrixOutField(13)],
    group: "combi3",
    dff: {
      lutDffSelectBit: 1238,
      dffLatchSelectBit: 1199,
      outputSelectBit: 1198,
      nRstNSetSelectBit: 1197,
      initialPolarityBit: 1196,
      clk: matrixOutField(11),
      d: matrixOutField(12),
      nRstNSet: matrixOutField(13),
    },
  },
  {
    id: "LUT3_2", // Fig 22 p. 56, Table 32 p. 58, setting byte 0x96
    nBits: 3,
    truth: { msb: 1207, lsb: 1200 },
    inputs: [matrixOutField(14), matrixOutField(15), matrixOutField(16)],
    group: "combi3",
    dff: {
      lutDffSelectBit: 1239,
      dffLatchSelectBit: 1207,
      outputSelectBit: 1206,
      nRstNSetSelectBit: 1205,
      initialPolarityBit: 1204,
      clk: matrixOutField(14),
      d: matrixOutField(15),
      nRstNSet: matrixOutField(16),
    },
  },
  {
    id: "LUT3_3", // Fig 23 p. 56, Table 33 p. 58, setting byte 0x97
    nBits: 3,
    truth: { msb: 1215, lsb: 1208 },
    inputs: [matrixOutField(17), matrixOutField(18), matrixOutField(19)],
    group: "combi3",
    dff: {
      lutDffSelectBit: 1240,
      dffLatchSelectBit: 1215,
      outputSelectBit: 1214,
      nRstNSetSelectBit: 1213,
      initialPolarityBit: 1212,
      clk: matrixOutField(17),
      d: matrixOutField(18),
      nRstNSet: matrixOutField(19),
    },
  },
  {
    id: "LUT3_4", // Fig 24 p. 57, Table 34 p. 58, setting byte 0x98
    nBits: 3,
    truth: { msb: 1223, lsb: 1216 },
    inputs: [matrixOutField(20), matrixOutField(21), matrixOutField(22)],
    group: "combi3",
    dff: {
      lutDffSelectBit: 1241,
      dffLatchSelectBit: 1223,
      outputSelectBit: 1222,
      nRstNSetSelectBit: 1221,
      initialPolarityBit: 1220,
      clk: matrixOutField(20),
      d: matrixOutField(21),
      nRstNSet: matrixOutField(22),
    },
  },
  {
    id: "LUT3_5", // Fig 25 p. 57, Table 35 p. 58, setting byte 0x99
    nBits: 3,
    truth: { msb: 1231, lsb: 1224 },
    inputs: [matrixOutField(23), matrixOutField(24), matrixOutField(25)],
    group: "combi3",
    dff: {
      lutDffSelectBit: 1242,
      dffLatchSelectBit: 1231,
      outputSelectBit: 1230,
      nRstNSetSelectBit: 1229,
      initialPolarityBit: 1228,
      clk: matrixOutField(23),
      d: matrixOutField(24),
      nRstNSet: matrixOutField(25),
    },
  },
  // ---- 3-bit LUT6 / pipe delay / ripple counter (pp. 61-64) ----
  {
    id: "LUT3_6", // Fig 28 p. 63, Table 37 p. 64
    nBits: 3,
    // Truth table = bits [1255:1248] per Table 37 (p. 64) / Table 59 byte 0x9C
    // (in pipe-delay mode these bits become the OUT0/OUT1 stage selectors,
    // in ripple-counter mode nSET/END values -- see byte 0x9C, p. 155).
    truth: { msb: 1255, lsb: 1248 },
    inputs: [matrixOutField(26), matrixOutField(27), matrixOutField(28)],
    group: "pipedelay",
    // Pipe delay / ripple counter selection: bit [1257] 0=LUT3_6, 1=PipeDelay/RippleCnt;
    // bit [1258] 0=pipe delay, 1=ripple counter; bit [1256] OUT1 polarity. (byte 0x9D p. 156)
  },
  // ---- Multi-function 8-bit macrocells: 3-bit LUT7-13 / DFF10-16 ----
  // Truth tables: Tables 38-44 p. 74. Setting bytes: Table 59 pp. 160-169.
  {
    id: "LUT3_7", // Fig 31 p. 67, MF1; setting byte 0xA8 (bits 1351:1344)
    nBits: 3,
    truth: { msb: 1351, lsb: 1344 },
    inputs: [matrixOutField(34), matrixOutField(35), matrixOutField(36)],
    group: "mf8",
    dff: {
      lutDffSelectBit: 1339, // Fig 31 "LUT/DFF Sel"; see MF_MODE_FIELDS note
      dffLatchSelectBit: 1351,
      outputSelectBit: 1350,
      nRstNSetSelectBit: 1349,
      initialPolarityBit: 1348,
      clk: matrixOutField(34),
      nRstNSet: matrixOutField(35),
      d: matrixOutField(36),
    },
  },
  {
    id: "LUT3_8", // Fig 32 p. 68, MF2; setting byte 0xAC (1383:1376)
    nBits: 3,
    truth: { msb: 1383, lsb: 1376 },
    inputs: [matrixOutField(37), matrixOutField(38), matrixOutField(39)],
    group: "mf8",
    dff: {
      lutDffSelectBit: 1394, // Fig 32
      dffLatchSelectBit: 1383,
      outputSelectBit: 1382,
      nRstNSetSelectBit: 1381,
      initialPolarityBit: 1380,
      clk: matrixOutField(37),
      nRstNSet: matrixOutField(38),
      d: matrixOutField(39),
    },
  },
  {
    id: "LUT3_9", // Fig 33 p. 69, MF3; setting byte 0xB1 (1423:1416)
    nBits: 3,
    truth: { msb: 1423, lsb: 1416 },
    inputs: [matrixOutField(40), matrixOutField(41), matrixOutField(42)],
    group: "mf8",
    dff: {
      lutDffSelectBit: 1411, // Fig 33
      dffLatchSelectBit: 1423,
      outputSelectBit: 1422,
      nRstNSetSelectBit: 1421,
      initialPolarityBit: 1420,
      clk: matrixOutField(40),
      nRstNSet: matrixOutField(41),
      d: matrixOutField(42),
    },
  },
  {
    id: "LUT3_10", // Fig 34 p. 70, MF4; setting byte 0xB5 (1455:1448)
    nBits: 3,
    truth: { msb: 1455, lsb: 1448 },
    inputs: [matrixOutField(43), matrixOutField(44), matrixOutField(45)],
    group: "mf8",
    dff: {
      lutDffSelectBit: 1466, // Fig 34
      dffLatchSelectBit: 1455,
      outputSelectBit: 1454,
      nRstNSetSelectBit: 1453,
      initialPolarityBit: 1452,
      clk: matrixOutField(43),
      nRstNSet: matrixOutField(44),
      d: matrixOutField(45),
    },
  },
  {
    id: "LUT3_11", // Fig 35 p. 71, MF5; setting byte 0xBA (1495:1488)
    nBits: 3,
    truth: { msb: 1495, lsb: 1488 },
    inputs: [matrixOutField(46), matrixOutField(47), matrixOutField(48)],
    group: "mf8",
    dff: {
      lutDffSelectBit: 1483, // Fig 35
      dffLatchSelectBit: 1495,
      outputSelectBit: 1494,
      nRstNSetSelectBit: 1493,
      initialPolarityBit: 1492,
      clk: matrixOutField(46),
      nRstNSet: matrixOutField(47),
      d: matrixOutField(48),
    },
  },
  {
    id: "LUT3_12", // Fig 36 p. 72, MF6; setting byte 0xBE (1527:1520)
    nBits: 3,
    truth: { msb: 1527, lsb: 1520 },
    inputs: [matrixOutField(49), matrixOutField(50), matrixOutField(51)],
    group: "mf8",
    dff: {
      lutDffSelectBit: 1538, // Fig 36
      dffLatchSelectBit: 1527,
      outputSelectBit: 1526,
      nRstNSetSelectBit: 1525,
      initialPolarityBit: 1524,
      clk: matrixOutField(49),
      nRstNSet: matrixOutField(50),
      d: matrixOutField(51),
    },
  },
  {
    id: "LUT3_13", // Fig 37 p. 73, MF7; setting byte 0xC3 (1567:1560)
    nBits: 3,
    truth: { msb: 1567, lsb: 1560 },
    inputs: [matrixOutField(52), matrixOutField(53), matrixOutField(54)],
    group: "mf8",
    dff: {
      lutDffSelectBit: 1556, // Fig 37
      dffLatchSelectBit: 1567,
      outputSelectBit: 1566,
      nRstNSetSelectBit: 1565,
      initialPolarityBit: 1564,
      clk: matrixOutField(52),
      nRstNSet: matrixOutField(53),
      d: matrixOutField(54),
    },
  },
  // ---- Multi-function 16-bit macrocell: 4-bit LUT0 / DFF9 / CNT-DLY0/FSM0 ----
  {
    id: "LUT4_0", // Fig 51 p. 84, Table 45 p. 85; setting bytes 0xA1/0xA2 (1303:1288)
    nBits: 4,
    truth: { msb: 1303, lsb: 1288 },
    inputs: [
      matrixOutField(30),
      matrixOutField(31),
      matrixOutField(32),
      matrixOutField(33),
    ],
    group: "mf16",
    dff: {
      // In DFF mode ("Single DFF w RST and SET", mode value 0010000 of the
      // MF0 mode field -- Table 59 byte 0xA0, p. 156):
      //   Matrix A(out33)=D, B(out32)=nSET, C(out31)=nRST, D(out30)=CLK.
      lutDffSelectBit: 1282, // Fig 51 "LUT/DFF Sel register [1282]"
      dffLatchSelectBit: 1303, // byte 0xA2 p. 158: LUT4_0[15]
      outputSelectBit: 1302, // LUT4_0[14]
      initialPolarityBit: 1301, // LUT4_0[13]
      d: matrixOutField(33),
      nSet: matrixOutField(32),
      nRst: matrixOutField(31),
      clk: matrixOutField(30),
    },
  },
];

/**
 * Full multi-function-macrocell mode fields (Table 59, bytes 0xA0, 0xA7,
 * 0xAB, 0xB0, 0xB4, 0xB9, 0xBD, 0xC2; pp. 156-168). Each MF cell has a mode
 * field that picks LUT / DFF / CNT-DLY and the chained combinations.
 *
 * The register bits of each field, as LISTED in Table 59 (the datasheet
 * lists them in a non-monotonic order, e.g. "1339 1341 1340 1338 1337"):
 *
 *   MF0 (16-bit): bits {1286,1285,1282,1284,1283,1281,1280}, 7-bit value:
 *       Single 4-bit LUT        = 0000000
 *       Single DFF w RST & SET  = 0010000
 *       Single CNT/DLY          = 0000001
 *       (many chained modes -- see datasheet p. 156-158)
 *   MF1: {1339,1341,1340,1338,1337}  LUT=00000, DFF=10000, CNT=00001
 *   MF2: {1394,1375:1372}            LUT=00000, DFF=10000, CNT=00001
 *   MF3: {1411,1413,1412,1410,1409}  LUT=00000, DFF=00100, CNT=00001
 *   MF4: {1466,1447:1444}            LUT=00000, DFF=10000, CNT=00001
 *   MF5: {1483,1485,1484,1482,1481}  LUT=00000, DFF=00100, CNT=00001
 *   MF6: {1538,1519:1516}            LUT=00000, DFF=10000, CNT=00001
 *   MF7: {1556:1552}                 LUT=00000, DFF=10000, CNT=00001
 *
 * VERIFIED and unambiguous:
 *   - "single LUT" mode = all mode bits 0 (the erased/default state).
 *   - "single DFF" mode = ONLY the LUT/DFF Sel bit set, all other mode
 *     bits 0. The LUT/DFF Sel bit for each cell is labeled explicitly in
 *     block diagrams Figs 31-37/51 and is what LUTS[].dff.lutDffSelectBit
 *     holds: MF0=1282, MF1=1339, MF2=1394, MF3=1411, MF4=1466, MF5=1483,
 *     MF6=1538, MF7=1556.
 * UNVERIFIED: the exact bit-position mapping of the multi-bit value strings
 *   (e.g. which listed register the leftmost character of "0100010"
 *   corresponds to) for the chained CNT/DLY<->LUT/DFF combination modes.
 *   The datasheet's listed register order is inconsistent between rows
 *   (compare bytes 0xA7 and 0xB0). Any use of chained modes should be
 *   verified against a GreenPAK Designer export before trusting.
 */
export const MF_MODE_FIELDS: Record<string, number[]> = {
  MF0: [1286, 1285, 1282, 1284, 1283, 1281, 1280],
  MF1: [1339, 1341, 1340, 1338, 1337],
  MF2: [1394, 1375, 1374, 1373, 1372],
  MF3: [1411, 1413, 1412, 1410, 1409],
  MF4: [1466, 1447, 1446, 1445, 1444],
  MF5: [1483, 1485, 1484, 1482, 1481],
  MF6: [1538, 1519, 1518, 1517, 1516],
  MF7: [1556, 1555, 1554, 1553, 1552],
};

/**
 * DFF summary. On the SLG46826 every DFF shares its macrocell with a LUT
 * (there are no standalone DFFs):
 *   DFF0-2   <-> 2-bit LUT0-2      (D, CLK; no set/reset)
 *   PGen     <-> 2-bit LUT3
 *   DFF3-8   <-> 3-bit LUT0-5     (D, CLK, shared nRST/nSET)
 *   DFF9     <-> 4-bit LUT0 (MF0) (D, CLK, separate nSET and nRST)
 *   DFF10-16 <-> 3-bit LUT7-13 (MF1-7) (D, CLK, shared nRST/nSET)
 * Use LUTS[i].dff for the bit addresses; this table just maps names.
 */
export const DFF_TO_LUT: Record<string, string> = {
  DFF0: "LUT2_0",
  DFF1: "LUT2_1",
  DFF2: "LUT2_2",
  PGEN: "LUT2_3",
  DFF3: "LUT3_0",
  DFF4: "LUT3_1",
  DFF5: "LUT3_2",
  DFF6: "LUT3_3",
  DFF7: "LUT3_4",
  DFF8: "LUT3_5",
  DFF9: "LUT4_0",
  DFF10: "LUT3_7",
  DFF11: "LUT3_8",
  DFF12: "LUT3_9",
  DFF13: "LUT3_10",
  DFF14: "LUT3_11",
  DFF15: "LUT3_12",
  DFF16: "LUT3_13",
};

// ---------------------------------------------------------------------------
// 4. IO pads.
// ---------------------------------------------------------------------------
export type OeKind = "matrix" | "register" | "none";

export interface IoPadCfg {
  /**
   * Input mode [1:0]: 00 = digital in without Schmitt trigger,
   * 01 = digital in with Schmitt trigger, 10 = low-voltage digital in,
   * 11 = reserved (or analog on IO1/IO9/IO10/IO11/IO12/IO13/IO14).
   * undefined for output-only pads (IO6/IO7).
   */
  inputMode?: BitField;
  /**
   * Output mode [1:0]: 00 = Push-Pull 1x, 01 = Push-Pull 2x,
   * 10 = 1x Open-Drain NMOS, 11 = 2x Open-Drain NMOS.
   */
  outputMode: BitField;
  /** Pull resistor value [1:0]: 00 = floating, 01 = 10k, 10 = 100k, 11 = 1M. */
  pullResistance: BitField;
  /** Pull direction: 0 = pull-down, 1 = pull-up. */
  pullUpDownSelect: number;
  /**
   * Register OE bit (only for OeKind "register"): 0 = output driver
   * disabled (pad is input), 1 = output driver enabled. For OeKind
   * "matrix" the OE comes from the matrix selector (oeSel) instead and
   * this is undefined -- route MATRIX_SOURCES.VDD to oeSel for a
   * permanently-driven output.
   */
  oeRegisterBit?: number;
}

export interface IoPad {
  id: string;
  /** TSSOP-20 package pin number (Table on p. 9). */
  tssopPin: number;
  /** STQFN-20 package pin number (Table on p. 8). */
  stqfnPin: number;
  /** Supply rail: IO0-IO6 + SCL/SDA on VDD; IO7-IO14 on VDD2 (Sect. 5.1 p. 34). */
  rail: "VDD" | "VDD2";
  /** "GPIO" (in/out), "GPO" (output only), "GPI" (input only, SCL/SDA). */
  kind: "GPIO" | "GPO";
  /** Matrix input index of this pad's digital input (Table 21); -1 for GPO. */
  matrixInputIndex: number;
  /** Matrix output selector for the pad's output data (Table 22). */
  outSel: BitField;
  /** How OE works (Sect. 5.8/5.9/5.10, pp. 36-38). */
  oeKind: OeKind;
  /** Matrix output selector for OE (only when oeKind === "matrix"). */
  oeSel?: BitField;
  cfg: IoPadCfg;
  /** Special functions (Table 1, pp. 9-12). */
  altFunctions: string[];
}

export const IO_PADS: IoPad[] = [
  {
    // Register-OE structure (Fig 5, p. 37): OE bit [783] must be 1 to drive.
    id: "IO0",
    tssopPin: 19,
    stqfnPin: 2,
    rail: "VDD",
    kind: "GPIO",
    matrixInputIndex: 1,
    outSel: matrixOutField(67),
    oeKind: "register",
    cfg: {
      // Table 59 byte 0x61, p. 140
      inputMode: { msb: 777, lsb: 776 },
      outputMode: { msb: 779, lsb: 778 },
      pullResistance: { msb: 781, lsb: 780 },
      pullUpDownSelect: 782,
      oeRegisterBit: 783,
    },
    altFunctions: ["I2C_EXPAND_0", "EXT_OSC0_IN"],
  },
  {
    // Matrix-OE structure (Fig 4, p. 36): OE from matrix out 69.
    id: "IO1",
    tssopPin: 18,
    stqfnPin: 3,
    rail: "VDD",
    kind: "GPIO",
    matrixInputIndex: 2,
    outSel: matrixOutField(68),
    oeKind: "matrix",
    oeSel: matrixOutField(69),
    cfg: {
      // Table 59 byte 0x62, p. 140 (input mode 11 = analog input: EXT_Vref)
      inputMode: { msb: 785, lsb: 784 },
      outputMode: { msb: 787, lsb: 786 },
      pullResistance: { msb: 789, lsb: 788 },
      pullUpDownSelect: 790,
    },
    altFunctions: ["EXT_VREF (ACMP negative input)"],
  },
  {
    id: "IO2",
    tssopPin: 17,
    stqfnPin: 4,
    rail: "VDD",
    kind: "GPIO",
    matrixInputIndex: 3,
    outSel: matrixOutField(70),
    oeKind: "register",
    cfg: {
      // Table 59 byte 0x64, p. 141
      inputMode: { msb: 801, lsb: 800 },
      outputMode: { msb: 803, lsb: 802 },
      pullResistance: { msb: 805, lsb: 804 },
      pullUpDownSelect: 806,
      oeRegisterBit: 807,
    },
    altFunctions: ["EXT_SLA_0 (I2C address bit A4 source)"],
  },
  {
    id: "IO3",
    tssopPin: 16,
    stqfnPin: 5,
    rail: "VDD",
    kind: "GPIO",
    matrixInputIndex: 4,
    outSel: matrixOutField(71),
    oeKind: "register",
    cfg: {
      // Table 59 byte 0x65, p. 141
      inputMode: { msb: 809, lsb: 808 },
      outputMode: { msb: 811, lsb: 810 },
      pullResistance: { msb: 813, lsb: 812 },
      pullUpDownSelect: 814,
      oeRegisterBit: 815,
    },
    altFunctions: ["EXT_SLA_1 (I2C address bit A5 source)"],
  },
  {
    id: "IO4",
    tssopPin: 15,
    stqfnPin: 6,
    rail: "VDD",
    kind: "GPIO",
    matrixInputIndex: 5,
    outSel: matrixOutField(72),
    oeKind: "matrix",
    oeSel: matrixOutField(73),
    cfg: {
      // Table 59 byte 0x66, p. 141 (bit 823 Reserved -- OE is matrix)
      inputMode: { msb: 817, lsb: 816 },
      outputMode: { msb: 819, lsb: 818 },
      pullResistance: { msb: 821, lsb: 820 },
      pullUpDownSelect: 822,
    },
    altFunctions: ["EXT_SLA_2 (I2C address bit A6 source)"],
  },
  {
    id: "IO5",
    tssopPin: 14,
    stqfnPin: 7,
    rail: "VDD",
    kind: "GPIO",
    matrixInputIndex: 6,
    outSel: matrixOutField(74),
    oeKind: "matrix",
    oeSel: matrixOutField(75),
    cfg: {
      // Table 59 byte 0x67, p. 142
      inputMode: { msb: 825, lsb: 824 },
      outputMode: { msb: 827, lsb: 826 },
      pullResistance: { msb: 829, lsb: 828 },
      pullUpDownSelect: 830,
    },
    altFunctions: ["EXT_SLA_3 (I2C address bit A7 source)", "I2C_EXPAND_1"],
  },
  {
    // GPO, register-OE structure of Fig 6 (p. 38). No matrix input, no input mode.
    id: "IO6",
    tssopPin: 11,
    stqfnPin: 10,
    rail: "VDD",
    kind: "GPO",
    matrixInputIndex: -1,
    outSel: matrixOutField(76),
    oeKind: "register",
    cfg: {
      // Table 59 byte 0x6A, p. 143 (bits 849:848 Reserved)
      outputMode: { msb: 851, lsb: 850 },
      pullResistance: { msb: 853, lsb: 852 },
      pullUpDownSelect: 854,
      oeRegisterBit: 855,
    },
    altFunctions: ["I2C_EXPAND_2"],
  },
  {
    id: "IO7",
    tssopPin: 9,
    stqfnPin: 12,
    rail: "VDD2",
    kind: "GPO",
    matrixInputIndex: -1,
    outSel: matrixOutField(77),
    oeKind: "register",
    cfg: {
      // Table 59 byte 0x6B, p. 143 (bits 857:856 Reserved)
      outputMode: { msb: 859, lsb: 858 },
      pullResistance: { msb: 861, lsb: 860 },
      pullUpDownSelect: 862,
      oeRegisterBit: 863,
    },
    altFunctions: [],
  },
  {
    id: "IO8",
    tssopPin: 8,
    stqfnPin: 13,
    rail: "VDD2",
    kind: "GPIO",
    matrixInputIndex: 7,
    outSel: matrixOutField(78),
    oeKind: "matrix",
    oeSel: matrixOutField(79),
    cfg: {
      // Table 59 byte 0x6C, p. 143
      inputMode: { msb: 865, lsb: 864 },
      outputMode: { msb: 867, lsb: 866 },
      pullResistance: { msb: 869, lsb: 868 },
      pullUpDownSelect: 870,
    },
    altFunctions: ["EXT_OSC2_IN"],
  },
  {
    id: "IO9",
    tssopPin: 6,
    stqfnPin: 15,
    rail: "VDD2",
    kind: "GPIO",
    matrixInputIndex: 8,
    outSel: matrixOutField(80),
    oeKind: "matrix",
    oeSel: matrixOutField(81),
    cfg: {
      // Table 59 byte 0x6E, p. 144 (input mode 11 = analog output: Vref1)
      inputMode: { msb: 881, lsb: 880 },
      outputMode: { msb: 883, lsb: 882 },
      pullResistance: { msb: 885, lsb: 884 },
      pullUpDownSelect: 886,
    },
    altFunctions: ["VREF1_OUT", "I2C_EXPAND_3"],
  },
  {
    id: "IO10",
    tssopPin: 5,
    stqfnPin: 16,
    rail: "VDD2",
    kind: "GPIO",
    matrixInputIndex: 9,
    outSel: matrixOutField(82),
    oeKind: "matrix",
    oeSel: matrixOutField(83),
    cfg: {
      // Table 59 byte 0x6F, p. 144
      inputMode: { msb: 889, lsb: 888 },
      outputMode: { msb: 891, lsb: 890 },
      pullResistance: { msb: 893, lsb: 892 },
      pullUpDownSelect: 894,
    },
    altFunctions: ["VREF0_OUT", "EXT_OSC1_IN"],
  },
  {
    id: "IO11",
    tssopPin: 4,
    stqfnPin: 17,
    rail: "VDD2",
    kind: "GPIO",
    matrixInputIndex: 10,
    outSel: matrixOutField(84),
    oeKind: "matrix",
    oeSel: matrixOutField(85),
    cfg: {
      // Table 59 byte 0x70, p. 144 (input mode 11 = analog input: ACMP3L+)
      inputMode: { msb: 897, lsb: 896 },
      outputMode: { msb: 899, lsb: 898 },
      pullResistance: { msb: 901, lsb: 900 },
      pullUpDownSelect: 902,
    },
    altFunctions: ["ACMP3L_IN"],
  },
  {
    id: "IO12",
    tssopPin: 3,
    stqfnPin: 18,
    rail: "VDD2",
    kind: "GPIO",
    matrixInputIndex: 11,
    outSel: matrixOutField(86),
    oeKind: "matrix",
    oeSel: matrixOutField(87),
    cfg: {
      // Table 59 byte 0x71, p. 145
      inputMode: { msb: 905, lsb: 904 },
      outputMode: { msb: 907, lsb: 906 },
      pullResistance: { msb: 909, lsb: 908 },
      pullUpDownSelect: 910,
    },
    altFunctions: ["ACMP2L_IN"],
  },
  {
    id: "IO13",
    tssopPin: 2,
    stqfnPin: 19,
    rail: "VDD2",
    kind: "GPIO",
    matrixInputIndex: 12,
    outSel: matrixOutField(88),
    oeKind: "matrix",
    oeSel: matrixOutField(89),
    cfg: {
      // Table 59 byte 0x72, p. 145
      inputMode: { msb: 913, lsb: 912 },
      outputMode: { msb: 915, lsb: 914 },
      pullResistance: { msb: 917, lsb: 916 },
      pullUpDownSelect: 918,
    },
    altFunctions: ["ACMP1H_IN"],
  },
  {
    id: "IO14",
    tssopPin: 1,
    stqfnPin: 20,
    rail: "VDD2",
    kind: "GPIO",
    matrixInputIndex: 13,
    outSel: matrixOutField(90),
    oeKind: "matrix",
    oeSel: matrixOutField(91),
    cfg: {
      // Table 59 byte 0x73, p. 145
      inputMode: { msb: 921, lsb: 920 },
      outputMode: { msb: 923, lsb: 922 },
      pullResistance: { msb: 925, lsb: 924 },
      pullUpDownSelect: 926,
    },
    altFunctions: ["ACMP0H_IN"],
  },
];

/**
 * Non-IO package pins (TSSOP-20, table p. 9):
 *   pin 20 = VDD, pin 7 = VDD2, pin 10 = GND,
 *   pin 13 = SCL (I2C clock, GPI; input mode bits [834:833], pull res [836:835]),
 *   pin 12 = SDA (I2C data, GPI; input mode bits [842:841], pull res [844:843]).
 * SCL/SDA are input-only for user logic and are NOT matrix inputs.
 */
export const NON_IO_PINS: { tssopPin: number; name: string }[] = [
  { tssopPin: 20, name: "VDD" },
  { tssopPin: 13, name: "SCL" },
  { tssopPin: 12, name: "SDA" },
  { tssopPin: 10, name: "GND" },
  { tssopPin: 7, name: "VDD2" },
];

// ---------------------------------------------------------------------------
// 5. Oscillators (Table 59 bytes 0x80-0x84, pp. 148-149).
//    All-zero = oscillator controlled by matrix enable (matrix outs 57/58/59)
//    with "auto on by delay cells"; i.e. an erased image leaves them OFF.
// ---------------------------------------------------------------------------
export const OSC = {
  OSC1_2MHZ: {
    // byte 0x80
    forceOnBit: 1024, // 1 = always on (when matrix enable = 0)
    matrixPowerOnBit: 1025, // 0 = matrix controls power-down, 1 = matrix on
    externalClockBit: 1026, // 1 = external clock from IO10
    postDivider: { msb: 1028, lsb: 1027 }, // 00:/1 01:/2 10:/4 11:/8
    matrixDivider: { msb: 1031, lsb: 1029 }, // 000:/1 ... 111:/64
    matrixOutEnableBit: 1050, // byte 0x83: OSC1 matrix out enable
    secondMatrixOutEnableBit: 1054,
    secondMatrixDivider: { msb: 1058, lsb: 1056 },
  },
  OSC2_25MHZ: {
    // byte 0x81
    forceOnBit: 1032,
    matrixPowerOnBit: 1033,
    externalClockBit: 1034, // external clock from IO8
    postDivider: { msb: 1036, lsb: 1035 },
    matrixDivider: { msb: 1039, lsb: 1037 },
    matrixOutEnableBit: 1051,
    startupDelayDisableBit: 1052, // 0: 100ns startup delay enabled, 1: disabled
  },
  OSC0_2KHZ: {
    // byte 0x82
    forceOnBit: 1040,
    matrixPowerOnBit: 1041,
    externalClockBit: 1042, // external clock from IO0
    postDivider: { msb: 1044, lsb: 1043 },
    matrixDivider: { msb: 1047, lsb: 1045 },
    matrixOutEnableBit: 1049,
    secondMatrixOutEnableBit: 1053,
    secondMatrixDivider: { msb: 1061, lsb: 1059 },
  },
} as const;

// ---------------------------------------------------------------------------
// 6. I2C / system bits and safe defaults.
// ---------------------------------------------------------------------------
export const I2C = {
  /** Virtual inputs (matrix sources 48-55) live at register bits 976-983 (byte 0x7A). */
  virtualInputBits: { msb: 983, lsb: 976 },
  /** Virtual outputs: matrix input values readable at bytes 0x74-0x7B (Sect. 6.4 p. 48). */
  /** I2C soft-reset bit (reloads NVM into registers): bit [1601], byte 0xC8. */
  softResetBit: 1601,
  /** IO latching during I2C write: bit [1602] -- NOTE inverted: 1=disable, 0=enable. */
  ioLatchDisableBit: 1602,
  /** I2C write mask bits [1615:1608], byte 0xC9: 1 = mask (protect) bit lane. */
  writeMaskBits: { msb: 1615, lsb: 1608 },
  /**
   * I2C slave address / control code, bits [1619:1616] (byte 0xCA).
   * "The default control code is 0001" (Sect. 15.2, p. 119). Bits
   * [1623:1620] select, per control-code bit A4..A7, whether it comes from
   * this register (0) or from pins IO2/IO3/IO4/IO5 (1).
   */
  slaveAddress: { msb: 1619, lsb: 1616 },
  slaveAddressFromPinBits: { a4: 1620, a5: 1621, a6: 1622, a7: 1623 },
  /** I2C fast mode+: bit [769] (byte 0x60), 0 = standard/fast, 1 = fast mode+. */
  fastModePlusBit: 769,
  /** IO fast pull-up/down during power-up enable: bit [768] (byte 0x60). */
  fastPullDuringPowerUpBit: 768,
  /** Pattern ID byte: bits [1631:1624] (byte 0xCB), free for user ID. */
  patternId: { msb: 1631, lsb: 1624 },
} as const;

/**
 * Register/NVM protection block (bytes 0xE0-0xE4, Table 59 pp. 171-172 and
 * Ch. 16). All zero = unprotected, which is what a blank image wants.
 *   0xE0 RPR: register read/write protection
 *   0xE1 NPR: NVM protection
 *   0xE2 WPR bit [1810]: write-protect enable
 *   0xE3 ERSE bits: page-erase control (I2C-volatile, not part of a design)
 *   0xE4 bit [1824]: protection lock
 */

/**
 * Byte values that a minimal working design must contain that differ from
 * an all-0x00 image.
 *
 * Background: Table 59 (pp. 135-173) does not print a per-field default
 * column; the working assumption (consistent with GreenPAK tooling) is that
 * an erased configuration is all zeros and that all-zeros is functionally
 * safe: all matrix selectors point at source 0 = GND, all LUTs output 0,
 * oscillators are off (auto/matrix-gated, matrix enable = GND), all IOs are
 * inputs (register-OE bits 0, matrix OE = GND) with pulls floating, and all
 * protection is off.
 *
 * The one field that must NOT be zero: the I2C control code, bits
 * [1619:1616] (byte 0xCA). Datasheet Sect. 15.2 (p. 119): "The default
 * control code is 0001", and control codes 0000/1111 collide with I2C
 * reserved address ranges. Program 0b0001 -> byte 0xCA = 0x01
 * (bit 1616 = LSB of the code).
 */
export const DEFAULT_IMAGE_OVERRIDES: { byte: number; value: number }[] = [
  { byte: 0xca, value: 0x01 }, // I2C control code = 0001 (Sect. 15.2 p. 119)
  // UNVERIFIED: no other must-be-nonzero bits were found in Table 59
  // (pp. 135-173); there is no "reserved must-be-1" note anywhere in the
  // register map. Cross-check a GreenPAK Designer export of an empty
  // project if absolute certainty is required.
];

// ---------------------------------------------------------------------------
// 7. Tiny helpers for building the 256-byte image.
// ---------------------------------------------------------------------------

/** Set a single register bit in a 256-byte image. */
export function setBit(image: Uint8Array, bit: number, value: 0 | 1): void {
  const byte = bit >> 3;
  const pos = bit & 7;
  if (value) image[byte] |= 1 << pos;
  else image[byte] &= ~(1 << pos);
}

/** Write `value` into a bit field (LSB-first within the field). */
export function setField(image: Uint8Array, f: BitField, value: number): void {
  const width = fieldWidth(f);
  for (let i = 0; i < width; i++) {
    setBit(image, f.lsb + i, ((value >> i) & 1) as 0 | 1);
  }
}

/** Route a matrix source into a destination selector field. */
export function connect(
  image: Uint8Array,
  destField: BitField,
  sourceIndex: number
): void {
  setField(image, destField, sourceIndex);
}

/** Create a blank image with the required non-zero defaults applied. */
export function blankImage(): Uint8Array {
  const image = new Uint8Array(256);
  for (const { byte, value } of DEFAULT_IMAGE_OVERRIDES) image[byte] = value;
  return image;
}
