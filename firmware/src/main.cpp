// GreenPAK Web Editor bridge firmware for M5StampS3.
// Speaks JSON-lines over USB CDC; bridges to an SLG46826 over I2C.
// Protocol: docs/protocol.md
#include <Arduino.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <Wire.h>

#include "slg46826.h"

static const char *FW_VERSION = "0.1.0";

static Preferences prefs;
static SLG46826 chip(Wire);
static int pinSda = 13; // M5StampS3 defaults; overridable via i2c_config
static int pinScl = 15;
static uint32_t i2cFreq = 100000;
static bool i2cReady = false;

static void applyI2c() {
  Wire.end();
  Wire.begin(pinSda, pinScl, i2cFreq);
  Wire.setTimeOut(50);
  i2cReady = true;
}

static String toHex(const uint8_t *buf, size_t len) {
  String s;
  s.reserve(len * 2);
  for (size_t i = 0; i < len; i++) {
    char b[3];
    snprintf(b, sizeof(b), "%02x", buf[i]);
    s += b;
  }
  return s;
}

static int fromHex(const String &s, uint8_t *buf, size_t maxLen) {
  size_t n = s.length() / 2;
  if (s.length() % 2 || n > maxLen) return -1;
  for (size_t i = 0; i < n; i++) {
    char hi = s[i * 2], lo = s[i * 2 + 1];
    auto nib = [](char c) -> int {
      if (c >= '0' && c <= '9') return c - '0';
      if (c >= 'a' && c <= 'f') return c - 'a' + 10;
      if (c >= 'A' && c <= 'F') return c - 'A' + 10;
      return -1;
    };
    int h = nib(hi), l = nib(lo);
    if (h < 0 || l < 0) return -1;
    buf[i] = (h << 4) | l;
  }
  return (int)n;
}

static void reply(JsonDocument &doc) {
  serializeJson(doc, Serial);
  Serial.println();
}

static void replyErr(const char *msg) {
  JsonDocument doc;
  doc["ok"] = false;
  doc["err"] = msg;
  reply(doc);
}

static void handleCommand(JsonDocument &req) {
  const char *cmd = req["cmd"] | "";
  JsonDocument res;
  res["ok"] = true;

  if (!strcmp(cmd, "ping")) {
    res["fw"] = FW_VERSION;
    res["device"] = "greenpak-bridge";
  } else if (!strcmp(cmd, "i2c_config")) {
    if (req["sda"].is<int>()) pinSda = req["sda"];
    if (req["scl"].is<int>()) pinScl = req["scl"];
    if (req["freq"].is<uint32_t>()) i2cFreq = req["freq"];
    if (req["cc"].is<int>()) chip.setControlCode(req["cc"]);
    applyI2c();
    if (req["save"] | false) {
      prefs.putInt("sda", pinSda);
      prefs.putInt("scl", pinScl);
      prefs.putUInt("freq", i2cFreq);
    }
    res["sda"] = pinSda;
    res["scl"] = pinScl;
    res["freq"] = i2cFreq;
    res["cc"] = chip.controlCode();
  } else if (!strcmp(cmd, "scan")) {
    JsonArray found = res["found"].to<JsonArray>();
    for (uint8_t a = 1; a < 0x78; a++) {
      Wire.beginTransmission(a);
      if (Wire.endTransmission() == 0) found.add(a);
    }
  } else if (!strcmp(cmd, "reg_read")) {
    uint8_t buf[256];
    int off = req["off"] | 0;
    int len = req["len"] | 256;
    if (off < 0 || len < 1 || off + len > 256) return replyErr("range");
    if (!chip.readBytes(SLG46826::BLOCK_REG, off, buf, len))
      return replyErr("i2c read failed");
    res["data"] = toHex(buf, len);
  } else if (!strcmp(cmd, "reg_write")) {
    uint8_t buf[256];
    int n = fromHex(req["data"] | String(), buf, sizeof(buf));
    if (n <= 0) return replyErr("bad hex");
    int off = req["off"] | 0;
    if (off + n > 256) return replyErr("range");
    if (!chip.writeRegisters(buf, n, off)) return replyErr("i2c write failed");
    res["written"] = n;
  } else if (!strcmp(cmd, "nvm_read")) {
    uint8_t buf[256];
    if (!chip.readNvm(buf)) return replyErr("i2c read failed");
    res["data"] = toHex(buf, 256);
  } else if (!strcmp(cmd, "nvm_write")) {
    uint8_t buf[256];
    if (fromHex(req["data"] | String(), buf, sizeof(buf)) != 256)
      return replyErr("need exactly 256 bytes of hex");
    if (!chip.writeNvm(buf)) {
      JsonDocument e;
      e["ok"] = false;
      e["err"] = "nvm write failed";
      e["page"] = chip.errorPage();
      return reply(e);
    }
    // Return the read-back image; the browser verifies against the
    // ISP-guide ignore-bit mask (some bits read differently by design).
    uint8_t back[256];
    if (!chip.readNvm(back)) return replyErr("verify read failed");
    res["readback"] = toHex(back, 256);
  } else if (!strcmp(cmd, "reset")) {
    if (!chip.softReset()) return replyErr("reset failed");
  } else {
    return replyErr("unknown cmd");
  }
  reply(res);
}

void setup() {
  Serial.begin(115200);
  prefs.begin("gpbridge");
  pinSda = prefs.getInt("sda", pinSda);
  pinScl = prefs.getInt("scl", pinScl);
  i2cFreq = prefs.getUInt("freq", i2cFreq);
  applyI2c();
}

void loop() {
  static String line;
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n') {
      line.trim();
      if (line.length()) {
        JsonDocument req;
        if (deserializeJson(req, line) == DeserializationError::Ok) {
          handleCommand(req);
        } else {
          replyErr("bad json");
        }
      }
      line = "";
    } else if (line.length() < 2048) {
      line += c;
    }
  }
}
