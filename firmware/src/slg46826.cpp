#include "slg46826.h"

bool SLG46826::readBytes(uint8_t block, uint8_t offset, uint8_t *buf, size_t len) {
  uint8_t a = addr(block);
  wire_.beginTransmission(a);
  wire_.write(offset);
  if (wire_.endTransmission(false) != 0) {
    wire_.endTransmission(true);
    return false;
  }
  size_t got = 0;
  while (got < len) {
    size_t chunk = min((size_t)32, len - got);
    size_t n = wire_.requestFrom((int)a, (int)chunk, (int)(got + chunk >= len));
    if (n == 0) return false;
    while (wire_.available() && got < len) buf[got++] = wire_.read();
    if (got < len) {
      // re-address for next chunk
      wire_.beginTransmission(a);
      wire_.write(offset + got);
      if (wire_.endTransmission(false) != 0) {
        wire_.endTransmission(true);
        return false;
      }
    }
  }
  return true;
}

bool SLG46826::writeBytes(uint8_t block, uint8_t offset, const uint8_t *data, size_t len) {
  wire_.beginTransmission(addr(block));
  wire_.write(offset);
  wire_.write(data, len);
  return wire_.endTransmission() == 0;
}

bool SLG46826::readAll(uint8_t block, uint8_t *buf256) {
  for (int page = 0; page < 16; page++) {
    if (!readBytes(block, page << 4, buf256 + (page << 4), 16)) return false;
  }
  return true;
}

bool SLG46826::writeRegisters(const uint8_t *data, size_t len, uint8_t offset) {
  // Register space accepts sequential writes; chunk to stay inside the
  // Arduino Wire 128-byte buffer.
  size_t done = 0;
  while (done < len) {
    size_t chunk = min((size_t)16, len - done);
    if (!writeBytes(BLOCK_REG, offset + done, data + done, chunk)) return false;
    done += chunk;
  }
  return true;
}

bool SLG46826::erasePage(uint8_t page, bool eeprom) {
  if (!eeprom && page > 14) return false; // never erase the service page
  uint8_t v = (eeprom ? 0x90 : 0x80) | (page & 0x0F);
  wire_.beginTransmission(addr(BLOCK_REG));
  wire_.write(ERSR);
  wire_.write(v);
  // Known silicon quirk: some SLG46826 revisions NACK the ERSR data byte even
  // though the erase succeeds, so ignore the transmission result and poll.
  wire_.endTransmission();
  delay(25);
  return ackPoll(addr(BLOCK_REG));
}

bool SLG46826::writeNvm(const uint8_t *buf256) {
  // Pages 0-13 only: page 14 is the protection page (wrong values can
  // permanently lock the chip), page 15 is the factory service page
  // (read-only; erasing it bricks the device).
  errorPage_ = -1;
  for (uint8_t page = 0; page < 14; page++) {
    if (!erasePage(page)) { errorPage_ = page; return false; }
    if (!writeBytes(BLOCK_NVM, page << 4, buf256 + (page << 4), 16)) {
      errorPage_ = page;
      return false;
    }
    delay(25);
    if (!ackPoll(addr(BLOCK_NVM))) { errorPage_ = page; return false; }
  }
  return softReset();
}

bool SLG46826::softReset() {
  uint8_t v = 0x02;
  bool ok = writeBytes(BLOCK_REG, RESET_REG, &v, 1);
  delay(150); // reload NVM -> registers
  return ok;
}

bool SLG46826::ackPoll(uint8_t address, uint32_t timeoutMs) {
  uint32_t t0 = millis();
  while (millis() - t0 < timeoutMs) {
    wire_.beginTransmission(address);
    if (wire_.endTransmission() == 0) return true;
    delay(2);
  }
  return false;
}
