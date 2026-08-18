# GreenPAK Web Editor

A browser-based logic editor and programmer for the **Renesas GreenPAK SLG46826V**
(sold by Akizuki Denshi as a [20-pin DIP module](https://akizukidenshi.com/catalog/g/g118084/)),
using an **M5StampS3** as a USB-serial ⇔ I2C bridge.

**Live demo: https://goroman.github.io/greenpak-webeditor/** (Chrome/Edge — WebSerial required)

![node-graph editor](https://img.shields.io/badge/editor-SVG%20node%20graph-4da3ff)
![i18n](https://img.shields.io/badge/UI-日本語%20%2F%20English%20%2F%20中文-3ddc97)

## Features

- **Node-graph editor** — place GPIO ins/outs, logic gates (LUT2/3/4), D flip-flops,
  I2C virtual inputs, oscillators; wire them by dragging. Grid snapping, auto-layout,
  auto-connect, undo/redo, non-overlapping placement.
- **In-browser compiler** — the graph compiles directly to the SLG46826's 256-byte
  configuration image. The connection matrix, LUT truth tables, DFF modes, and IO pad
  config are generated from a register map transcribed from the datasheet (Rev 3.18) —
  no vendor tools required.
- **Live tri-state logic preview** — toggle inputs and watch signals propagate:
  H = green glow with animated flowing dots, L = blue, Hi-Z (unconnected) = amber dashed.
  DFFs simulate clock edges and async reset; a 4-bit ripple counter preset actually counts.
- **Live hardware monitor** — polls the chip's matrix-input registers so the on-screen
  logic follows the *real* pin levels.
- **I2C virtual inputs** — flip a toggle in the browser and it writes register 0x7A on
  the chip: inject signals with no physical wiring.
- **74-series presets** — 7400/02/04/08/32/86, 7410, 7474, 74138 decoder, 74157 MUX,
  74393 4-bit counter, and a 4-bit address decoder. Presets load as editable graphs.
- **Volatile & NVM programming** — iterate via volatile register writes (unlimited),
  then burn to NVM (MTP, ~1000 cycles) with erase, write, and masked verify.
- **Truth table editor** — gate-preset buttons plus a clickable truth table per LUT.
- Save/load graphs as JSON, share a full circuit via URL, resource gauges in the header,
  Japanese/English/Chinese UI.

## Getting started

### 1. Flash the bridge firmware (M5StampS3)

```sh
cd firmware
pio run -t upload        # PlatformIO + Arduino framework
```

### 2. Wire it up

| M5StampS3 | SLG46826V DIP module |
|---|---|
| 3.3V | pin 20 (VDD) + pin 7 (VDD2) |
| GND | pin 10 (GND) |
| GPIO13 (default SDA) | pin 12 (SDA) |
| GPIO15 (default SCL) | pin 13 (SCL) |

- Add **2.2–4.7 kΩ pull-ups to 3.3 V** on SDA/SCL.
- Run the module at 3.3 V only while the StampS3 is attached.
- SDA/SCL GPIOs are configurable from the web UI (⚙, persisted to NVS).

Module pin numbers match the TSSOP-20 package. Usable logic pins:

| Module pin | IO | Notes |
|---|---|---|
| 1–6, 8 | IO14–IO9, IO8 | in/out (VDD2 rail) |
| 9, 11 | IO7, IO6 | **output only** |
| 14–19 | IO5–IO0 | in/out (VDD rail) |

### 3. Open the editor

Use the [hosted version](https://goroman.github.io/greenpak-webeditor/) or run locally:

```sh
cd web
npm install
npm run dev              # http://localhost:5173, Chrome/Edge
```

Click **Connect**, pick the M5StampS3's serial port (an I2C scan should find
0x08/0x0a/0x0b), load a preset or draw your own logic, then write it:
**volatile registers** for quick iteration, **NVM** to make it permanent.

## Repository layout

```
web/       Vite + TypeScript editor, compiler, simulator (npm test = vitest)
firmware/  PlatformIO Arduino bridge (JSON-lines serial protocol)
docs/      Serial protocol spec + SLG46826 programming notes
```

## Safety

- NVM page 15 (factory service page) is never touched; page 14 (protection page)
  is excluded by default — both are guarded in firmware.
- The ERSR erase-NACK silicon quirk is handled (NACK ignored + ACK polling).
- Verify applies the ISP guide's ignore-bit mask.
- The compiler always keeps the I2C control code at 0001 so the chip never
  moves to a different address after programming.

## References

- [SLG46826 datasheet Rev 3.18](https://akizukidenshi.com/goodsaffix/SLG46826.pdf)
- [In-System Programming Guide ISPG-SLG46824/6](https://www.renesas.com/en/document/mat/system-programming-guide-slg468246)
- [docs/slg46826-notes.md](docs/slg46826-notes.md) (implementation notes, Japanese)
