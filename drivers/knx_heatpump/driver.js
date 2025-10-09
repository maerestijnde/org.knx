'use strict';

const KNXGenericDriver = require('../../lib/GenericKNXDriver');

class KNXHeatpumpDriver extends KNXGenericDriver {

  async onInit() {
    await super.onInit();
    this.log('KNX Heatpump driver has been initialized');
  }

}

module.exports = KNXHeatpumpDriver;
