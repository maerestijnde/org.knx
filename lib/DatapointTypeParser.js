'use strict';

// Static function to convert the buffer received from a KNX event to
// something that can be used with Homey capabilities.

class DatapointTypeParser {

  // Defined in https://bitbucket.org/ekarak/knx.js/src/master/README-datapoints.md

  // DPT 1.xxx - decode (read from KNX)
  static bitFormat(buffer, defaultValue = 1) {
    if (buffer.length < 1) return defaultValue;
    return Boolean(buffer.readInt8(0));
  }

  // DPT 1.xxx - encode (write to KNX)
  static encodeDpt1(value) {
    const buffer = Buffer.alloc(1);
    buffer.writeUInt8(value ? 1 : 0, 0);
    return buffer;
  }

  // DPT 5
  static dim(buffer, defaultValue = 128) {
    if (buffer.length < 1) return defaultValue;
    return (buffer.readUInt8(0) / 255);
  }

  static colorChannel(buffer, defaultValue = 0) {
    if (buffer.length < 1) return defaultValue;
    return buffer.readUInt8(0);
  }

  // DPT9 2byte for temperature / lux - decode
  static dpt9(buffer) {
    if (buffer && buffer.length === 2) {
      const sign = buffer[0] >> 7;
      const exponent = (buffer[0] & 0b01111000) >> 3;
      let mantissa = 256 * (buffer[0] & 0b00000111) + buffer[1];
      mantissa = (sign === 1) ? ~(mantissa ^ 2047) : mantissa;
      return this.ldexp((0.01 * mantissa), exponent);
    }
    return null;
  }

  // DPT9 2byte for temperature / lux - encode
  static encodeDpt9(value) {
    const buffer = Buffer.alloc(2);

    // Clamp value to valid range for DPT9
    let v = Math.max(-671088.64, Math.min(670760.96, value));

    // Calculate mantissa and exponent
    let exponent = 0;
    let mantissa = Math.round(v * 100);

    // Find appropriate exponent
    while (Math.abs(mantissa) > 2047 && exponent < 15) {
      exponent++;
      mantissa = Math.round(v * 100 / Math.pow(2, exponent));
    }

    // Handle sign
    const sign = mantissa < 0 ? 1 : 0;
    if (sign) {
      mantissa = (~(-mantissa) & 0x7FF);
    }

    // Pack into buffer
    buffer[0] = (sign << 7) | (exponent << 3) | ((mantissa >> 8) & 0x07);
    buffer[1] = mantissa & 0xFF;

    return buffer;
  }

  // type N8 for DPT20 1 byte (PDT_ENUM8) - decode (read from KNX)
  static dpt20(buffer, defaultValue = 0) {
    if (buffer.length < 1) return defaultValue;
    return buffer.readUInt8(0);
  }

  // type N8 for DPT20 1 byte (PDT_ENUM8) - encode (write to KNX)
  static encodeDpt20(value) {
    const buffer = Buffer.alloc(1);
    // Value should be 0-255 for HVAC modes typically 0-4
    buffer.writeUInt8(value & 0xFF, 0);
    return buffer;
  }

  // DPT 13.* - 4-byte signed value (for counters/energy)
  static dpt13(buffer) {
    if (!buffer || buffer.length !== 4 || !(buffer instanceof Buffer)) {
      return null;
    }
    return buffer.readInt32BE(0);
  }

  static dpt14(buffer) {
    if (!buffer
      || !(buffer.length === 4)
      || !(buffer instanceof Buffer)
    ) {
      return null;
    }

    return buffer.readFloatBE(0);
  }

  static dpt17(buffer) {
    if (buffer.length < 1) return 0;
    return buffer.readUInt8(0) & 0x3F; // First two bits are reserved, so must be ignored for this parsing
  }

  // Helper function for float calculations, copied form the knx library dpt9.js file.
  static ldexp(mantissa, exponent) {
    /* eslint-disable no-restricted-properties, no-nested-ternary */
    return exponent > 1023 // avoid multiplying by infinity
      ? mantissa * Math.pow(2, 1023) * Math.pow(2, exponent - 1023)
      : exponent < -1074 // avoid multiplying by zero
        ? mantissa * Math.pow(2, -1074) * Math.pow(2, exponent + 1074)
        : mantissa * Math.pow(2, exponent);
    /* eslint-enable */
  }

}

module.exports = DatapointTypeParser;
