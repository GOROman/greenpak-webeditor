#pragma once
#include <Arduino.h>
#include <Wire.h>

// SLG46826 in-system programming over I2C.
// 7-bit address = (control_code << 3) | block
//   block 0b000 = volatile registers, 0b010 = NVM, 0b011 = EEPROM
// Default control code is 0b0001 -> reg 0x08, NVM 0x0A, EEPROM 0x0B.
class SLG46826 {
public:
  static constexpr uint8_t BLOCK_REG = 0b000;
  static constexpr uint8_t BLOCK_NVM = 0b010;
  static constexpr uint8_t BLOCK_EEPROM = 0b011;
  static constexpr uint8_t ERSR = 0xE3;      // page erase register
  static constexpr uint8_t RESET_REG = 0xC8; // bit1 = i2c soft reset

  explicit SLG46826(TwoWire &wire) : wire_(wire) {}

  void setControlCode(uint8_t cc) { controlCode_ = cc & 0x0F; }
  uint8_t controlCode() const { return controlCode_; }
  uint8_t addr(uint8_t block) const { return (controlCode_ << 3) | block; }

  bool readBytes(uint8_t block, uint8_t offset, uint8_t *buf, size_t len);
  bool writeBytes(uint8_t block, uint8_t offset, const uint8_t *data, size_t len);

  // Whole 256-byte spaces
  bool readRegisters(uint8_t *buf256) { return readAll(BLOCK_REG, buf256); }
  bool readNvm(uint8_t *buf256) { return readAll(BLOCK_NVM, buf256); }

  // Volatile: writes config bytes directly into the register space (lost on power-off).
  bool writeRegisters(const uint8_t *data, size_t len, uint8_t offset = 0);

  // Non-volatile: erases and writes all 16 NVM pages, then soft-resets so the
  // new design loads. Returns false on the first failing page (errorPage_ set).
  bool writeNvm(const uint8_t *buf256);
  bool erasePage(uint8_t page, bool eeprom = false);
  bool softReset();

  int errorPage() const { return errorPage_; }

private:
  bool readAll(uint8_t block, uint8_t *buf256);
  bool ackPoll(uint8_t address, uint32_t timeoutMs = 100);

  TwoWire &wire_;
  uint8_t controlCode_ = 0b0001;
  int errorPage_ = -1;
};
