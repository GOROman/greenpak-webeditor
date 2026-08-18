# Serial protocol (browser ⇔ M5StampS3 bridge)

USB CDC, 115200 baud (rate irrelevant for native USB). **JSON lines**: each
request and response is a single JSON object terminated by `\n`.

Every response contains `ok: true` or `ok: false` plus `err: "<message>"`.

| cmd | request fields | response fields | notes |
|-----|----------------|-----------------|-------|
| `ping` | – | `fw`, `device` | connectivity / version check |
| `i2c_config` | `sda`, `scl`, `freq`, `cc`, `save` (all optional) | echo of effective values | `cc` = SLG46826 control code (default 1). `save:true` persists pins to NVS |
| `scan` | – | `found`: array of 7-bit addresses | I2C bus scan |
| `reg_read` | `off` (0), `len` (256) | `data`: hex string | volatile register space |
| `reg_write` | `off` (0), `data`: hex | `written` | volatile write — instant, lost on power-off |
| `nvm_read` | – | `data`: 512 hex chars | full 256-byte NVM |
| `nvm_write` | `data`: 512 hex chars | `verified`: bool, or `page` on failure | erases+writes all 16 pages, soft-resets, reads back |
| `reset` | – | – | soft reset (register 0xC8 bit1), reloads NVM |

## SLG46826 addressing

7-bit I2C address = `(control_code << 3) | block`. Blocks: `000` registers,
`010` NVM, `011` EEPROM. Default control code `0001` → 0x08 / 0x0A / 0x0B.

NVM page write: erase via register 0xE3 (`0x80|page`), then 16 bytes at
`page<<4` in the NVM block. Some silicon revisions NACK the erase data byte —
the firmware ignores that and ACK-polls instead.
