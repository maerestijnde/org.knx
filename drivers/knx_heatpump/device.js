'use strict';

const KNXGenericSensor = require('../../lib/GenericKNXSensor');
const DatapointTypeParser = require('../../lib/DatapointTypeParser');

class KNXHeatpumpDevice extends KNXGenericSensor {

  async onInit() {
    await super.onInit();

    this.log('KNX Heatpump device has been initialized');

    // Register capability listener for target temperature changes
    this.registerCapabilityListener('target_temperature', this.onCapabilityTargetTemperature.bind(this));
  }

  /**
   * Handle target temperature changes from Homey UI
   */
  onCapabilityTargetTemperature(value) {
    if (!this.knxInterface || !this.settings.ga_hc1_day_temp_setpoint) {
      return null;
    }
    
    // Validate temperature range (5-30°C as per documentation)
    if (value < 5 || value > 30) {
      this.error(`Temperature ${value}°C is out of range (5-30°C)`);
      throw new Error('Temperature must be between 5°C and 30°C');
    }

    return this.knxInterface.writeKNXGroupAddress(this.settings.ga_hc1_day_temp_setpoint, value, 'DPT9.1')
      // Reread the target temperature after a timeout to prevent mismatch between KNX device and Homey
      .then(() => this.homey.setTimeout(this.getTargetTemperature.bind(this), 500))
      .catch((knxerror) => {
        this.error(knxerror);
        throw new Error('Failed to set target temperature');
      });
  }

  /**
   * Read current target temperature from KNX
   */
  getTargetTemperature() {
    const settings = this.getSettings();
    if (!this.knxInterface || !settings.ga_hc1_day_temp_setpoint) {
      return;
    }
    this.knxInterface.readKNXGroupAddress(settings.ga_hc1_day_temp_setpoint)
      .catch(this.error);
  }

  /**
   * Called when KNX connection status changes
   */
  onKNXConnection(connectionStatus) {
    super.onKNXConnection(connectionStatus);

    if (connectionStatus !== 'connected') {
      return;
    }

    // Read initial values from KNX bus
    this.getTargetTemperature();
  }

  /**
   * Handle KNX events for all heatpump sensors
   */
  onKNXEvent(groupaddress, data) {
    const settings = this.getSettings();
    this.log('🔥 KNX Event received:', { groupaddress, data });

    // Handle HC1 Day Temperature Setpoint
    if (groupaddress === settings.ga_hc1_day_temp_setpoint) {
      this.log('🎯 Processing HC1 Day Temperature Setpoint event');
      const value = DatapointTypeParser.dpt9(data);
      this.setCapabilityValue('target_temperature', value).catch(this.error);
      this.log(`✅ Target Temperature updated: ${value}°C`);
      return;
    }

    // Handle Outside Temperature
    if (groupaddress === settings.ga_temperature_outside) {
      this.log('🌡️ Processing Outside Temperature event');
      const value = DatapointTypeParser.dpt9(data);
      this.setCapabilityValue('measure_temperature.outside', value).catch(this.error);
      this.log(`✅ Outside Temperature updated: ${value}°C`);
      return;
    }

    // Handle HC1 Flow Temperature
    if (groupaddress === settings.ga_temperature_hc1_flow) {
      this.log('🌡️ Processing HC1 Flow Temperature event');
      const value = DatapointTypeParser.dpt9(data);
      this.setCapabilityValue('measure_temperature.hc1_flow', value).catch(this.error);
      this.log(`✅ HC1 Flow Temperature updated: ${value}°C`);
      return;
    }

    // Handle DHW Temperature
    if (groupaddress === settings.ga_temperature_dhw) {
      this.log('🌡️ Processing DHW Temperature event');
      const value = DatapointTypeParser.dpt9(data);
      this.setCapabilityValue('measure_temperature.dhw', value).catch(this.error);
      this.log(`✅ DHW Temperature updated: ${value}°C`);
      return;
    }

    // Handle Water Pressure (DPT9 also works for pressure)
    if (groupaddress === settings.ga_pressure_water) {
      this.log('💧 Processing Water Pressure event');
      const valueInPa = DatapointTypeParser.dpt9(data);
      // Convert Pa to bar (1 bar = 100000 Pa)
      const valueInBar = valueInPa / 100000;
      this.setCapabilityValue('measure_pressure', valueInBar).catch(this.error);
      this.log(`✅ Water Pressure updated: ${valueInBar} bar (${valueInPa} Pa)`);
      return;
    }

    // Handle Status: Standby
    if (groupaddress === settings.ga_status_standby) {
      this.log('🔘 Processing Standby Status event');
      const value = DatapointTypeParser.bitFormat(data);
      this.setCapabilityValue('onoff.status_standby', value).catch(this.error);
      this.log(`✅ Standby Status updated: ${value}`);
      return;
    }

    // Handle Status: Heating
    if (groupaddress === settings.ga_status_heating) {
      this.log('🔥 Processing Heating Status event');
      const value = DatapointTypeParser.bitFormat(data);
      this.setCapabilityValue('onoff.status_heating', value).catch(this.error);
      this.log(`✅ Heating Status updated: ${value}`);
      return;
    }

    // Handle Status: Cooling
    if (groupaddress === settings.ga_status_cooling) {
      this.log('❄️ Processing Cooling Status event');
      const value = DatapointTypeParser.bitFormat(data);
      this.setCapabilityValue('onoff.status_cooling', value).catch(this.error);
      this.log(`✅ Cooling Status updated: ${value}`);
      return;
    }

    // Handle Status: DHW
    if (groupaddress === settings.ga_status_dhw) {
      this.log('🚿 Processing DHW Status event');
      const value = DatapointTypeParser.bitFormat(data);
      this.setCapabilityValue('onoff.status_dhw', value).catch(this.error);
      this.log(`✅ DHW Status updated: ${value}`);
      return;
    }

    // Handle Alarm: KNX Error
    if (groupaddress === settings.ga_alarm_knx_error) {
      this.log('⚠️ Processing KNX Error Alarm event');
      const value = DatapointTypeParser.bitFormat(data);
      this.setCapabilityValue('alarm_generic.knx_error', value).catch(this.error);
      this.log(`✅ KNX Error Alarm updated: ${value}`);
      return;
    }

    // Handle Alarm: Heating Error
    if (groupaddress === settings.ga_alarm_heating_error) {
      this.log('⚠️ Processing Heating Error Alarm event');
      const value = DatapointTypeParser.bitFormat(data);
      this.setCapabilityValue('alarm_generic.heating_error', value).catch(this.error);
      this.log(`✅ Heating Error Alarm updated: ${value}`);
      return;
    }

    // Handle Power: DHW
    if (groupaddress === settings.ga_power_dhw) {
      this.log('⚡ Processing DHW Power Consumption event');
      const value = DatapointTypeParser.dpt9(data);
      this.setCapabilityValue('measure_power.dhw', value).catch(this.error);
      this.log(`✅ DHW Power Consumption updated: ${value} W`);
      return;
    }

    // Handle Power: Heating Generator
    if (groupaddress === settings.ga_power_heating_generator) {
      this.log('⚡ Processing Heating Generator Power event');
      const value = DatapointTypeParser.dpt9(data);
      this.setCapabilityValue('measure_power.heating_generator', value).catch(this.error);
      this.log(`✅ Heating Generator Power updated: ${value} W`);
      return;
    }

    // Handle Power: Environmental Yield
    if (groupaddress === settings.ga_power_environmental_yield) {
      this.log('🌱 Processing Environmental Yield event');
      const value = DatapointTypeParser.dpt9(data);
      this.setCapabilityValue('measure_power.environmental_yield', value).catch(this.error);
      this.log(`✅ Environmental Yield updated: ${value} W`);
      return;
    }

    // Handle Energy: DHW Total Consumption
    if (groupaddress === settings.ga_energy_dhw_consumption) {
      this.log('📊 Processing DHW Total Energy Consumption event');
      const value = DatapointTypeParser.dpt9(data);
      // Assuming the value is in kWh
      this.setCapabilityValue('meter_power.dhw_consumption', value).catch(this.error);
      this.log(`✅ DHW Total Energy Consumption updated: ${value} kWh`);
      return;
    }

    // Handle Energy: Heating Total Consumption
    if (groupaddress === settings.ga_energy_heating_consumption) {
      this.log('📊 Processing Heating Total Energy Consumption event');
      const value = DatapointTypeParser.dpt9(data);
      // Assuming the value is in kWh
      this.setCapabilityValue('meter_power.heating_consumption', value).catch(this.error);
      this.log(`✅ Heating Total Energy Consumption updated: ${value} kWh`);
      return;
    }

    // Log unhandled events
    this.log('⚠️ Unhandled KNX event:', groupaddress, data);
  }

  /**
   * Subscribe to all KNX group addresses
   */
  addKNXEventListeners(settings) {
    this.log('🔗 Subscribing to KNX group addresses...');

    // Subscribe to thermostat setpoint
    if (settings.ga_hc1_day_temp_setpoint) {
      this.knxInterface.addKNXEventListener(settings.ga_hc1_day_temp_setpoint, this.KNXEventHandler);
      this.log('✅ Subscribed to HC1 Day Temperature Setpoint:', settings.ga_hc1_day_temp_setpoint);
    }

    // Subscribe to temperature sensors
    if (settings.ga_temperature_outside) {
      this.knxInterface.addKNXEventListener(settings.ga_temperature_outside, this.KNXEventHandler);
      this.log('✅ Subscribed to Outside Temperature:', settings.ga_temperature_outside);
    }
    if (settings.ga_temperature_hc1_flow) {
      this.knxInterface.addKNXEventListener(settings.ga_temperature_hc1_flow, this.KNXEventHandler);
      this.log('✅ Subscribed to HC1 Flow Temperature:', settings.ga_temperature_hc1_flow);
    }
    if (settings.ga_temperature_dhw) {
      this.knxInterface.addKNXEventListener(settings.ga_temperature_dhw, this.KNXEventHandler);
      this.log('✅ Subscribed to DHW Temperature:', settings.ga_temperature_dhw);
    }
    if (settings.ga_pressure_water) {
      this.knxInterface.addKNXEventListener(settings.ga_pressure_water, this.KNXEventHandler);
      this.log('✅ Subscribed to Water Pressure:', settings.ga_pressure_water);
    }

    // Subscribe to status indicators
    if (settings.ga_status_standby) {
      this.knxInterface.addKNXEventListener(settings.ga_status_standby, this.KNXEventHandler);
      this.log('✅ Subscribed to Standby Status:', settings.ga_status_standby);
    }
    if (settings.ga_status_heating) {
      this.knxInterface.addKNXEventListener(settings.ga_status_heating, this.KNXEventHandler);
      this.log('✅ Subscribed to Heating Status:', settings.ga_status_heating);
    }
    if (settings.ga_status_cooling) {
      this.knxInterface.addKNXEventListener(settings.ga_status_cooling, this.KNXEventHandler);
      this.log('✅ Subscribed to Cooling Status:', settings.ga_status_cooling);
    }
    if (settings.ga_status_dhw) {
      this.knxInterface.addKNXEventListener(settings.ga_status_dhw, this.KNXEventHandler);
      this.log('✅ Subscribed to DHW Status:', settings.ga_status_dhw);
    }

    // Subscribe to alarms
    if (settings.ga_alarm_knx_error) {
      this.knxInterface.addKNXEventListener(settings.ga_alarm_knx_error, this.KNXEventHandler);
      this.log('✅ Subscribed to KNX Error Alarm:', settings.ga_alarm_knx_error);
    }
    if (settings.ga_alarm_heating_error) {
      this.knxInterface.addKNXEventListener(settings.ga_alarm_heating_error, this.KNXEventHandler);
      this.log('✅ Subscribed to Heating Error Alarm:', settings.ga_alarm_heating_error);
    }

    // Subscribe to power measurements
    if (settings.ga_power_dhw) {
      this.knxInterface.addKNXEventListener(settings.ga_power_dhw, this.KNXEventHandler);
      this.log('✅ Subscribed to DHW Power Consumption:', settings.ga_power_dhw);
    }
    if (settings.ga_power_heating_generator) {
      this.knxInterface.addKNXEventListener(settings.ga_power_heating_generator, this.KNXEventHandler);
      this.log('✅ Subscribed to Heating Generator Power:', settings.ga_power_heating_generator);
    }
    if (settings.ga_power_environmental_yield) {
      this.knxInterface.addKNXEventListener(settings.ga_power_environmental_yield, this.KNXEventHandler);
      this.log('✅ Subscribed to Environmental Yield:', settings.ga_power_environmental_yield);
    }

    // Subscribe to energy meters
    if (settings.ga_energy_dhw_consumption) {
      this.knxInterface.addKNXEventListener(settings.ga_energy_dhw_consumption, this.KNXEventHandler);
      this.log('✅ Subscribed to DHW Total Energy Consumption:', settings.ga_energy_dhw_consumption);
    }
    if (settings.ga_energy_heating_consumption) {
      this.knxInterface.addKNXEventListener(settings.ga_energy_heating_consumption, this.KNXEventHandler);
      this.log('✅ Subscribed to Heating Total Energy Consumption:', settings.ga_energy_heating_consumption);
    }

    this.log('✅ All KNX subscriptions completed');
  }

  /**
   * Called when settings are changed
   */
  async onSettings({ oldSettings, newSettings, changedKeys }) {
    this.log('Settings were changed:', changedKeys);
    
    // Prevents the listeners from being set if there is no valid KNX interface to use.
    if (this.knxInterface !== undefined) {
      this.log('Removing old KNX event listeners...');
      this.removeKNXEventListeners(oldSettings);
      
      this.log('Adding new KNX event listeners...');
      this.addKNXEventListeners(newSettings);
      
      this.log('✅ Settings updated successfully');
    } else {
      this.log('⚠️ No KNX interface available, skipping listener update');
    }
  }

  /**
   * Removes all KNX event listeners (override parent to handle heatpump-specific GAs)
   */
  removeKNXEventListeners(settings) {
    this.log('🔌 Unsubscribing from KNX group addresses...');

    // Unsubscribe from thermostat setpoint
    if (settings.ga_hc1_day_temp_setpoint) {
      this.knxInterface.removeKNXEventListener(settings.ga_hc1_day_temp_setpoint, this.KNXEventHandler);
    }

    // Unsubscribe from temperature sensors
    if (settings.ga_temperature_outside) {
      this.knxInterface.removeKNXEventListener(settings.ga_temperature_outside, this.KNXEventHandler);
    }
    if (settings.ga_temperature_hc1_flow) {
      this.knxInterface.removeKNXEventListener(settings.ga_temperature_hc1_flow, this.KNXEventHandler);
    }
    if (settings.ga_temperature_dhw) {
      this.knxInterface.removeKNXEventListener(settings.ga_temperature_dhw, this.KNXEventHandler);
    }
    if (settings.ga_pressure_water) {
      this.knxInterface.removeKNXEventListener(settings.ga_pressure_water, this.KNXEventHandler);
    }

    // Unsubscribe from status indicators
    if (settings.ga_status_standby) {
      this.knxInterface.removeKNXEventListener(settings.ga_status_standby, this.KNXEventHandler);
    }
    if (settings.ga_status_heating) {
      this.knxInterface.removeKNXEventListener(settings.ga_status_heating, this.KNXEventHandler);
    }
    if (settings.ga_status_cooling) {
      this.knxInterface.removeKNXEventListener(settings.ga_status_cooling, this.KNXEventHandler);
    }
    if (settings.ga_status_dhw) {
      this.knxInterface.removeKNXEventListener(settings.ga_status_dhw, this.KNXEventHandler);
    }

    // Unsubscribe from alarms
    if (settings.ga_alarm_knx_error) {
      this.knxInterface.removeKNXEventListener(settings.ga_alarm_knx_error, this.KNXEventHandler);
    }
    if (settings.ga_alarm_heating_error) {
      this.knxInterface.removeKNXEventListener(settings.ga_alarm_heating_error, this.KNXEventHandler);
    }

    // Unsubscribe from power measurements
    if (settings.ga_power_dhw) {
      this.knxInterface.removeKNXEventListener(settings.ga_power_dhw, this.KNXEventHandler);
    }
    if (settings.ga_power_heating_generator) {
      this.knxInterface.removeKNXEventListener(settings.ga_power_heating_generator, this.KNXEventHandler);
    }
    if (settings.ga_power_environmental_yield) {
      this.knxInterface.removeKNXEventListener(settings.ga_power_environmental_yield, this.KNXEventHandler);
    }

    // Unsubscribe from energy meters
    if (settings.ga_energy_dhw_consumption) {
      this.knxInterface.removeKNXEventListener(settings.ga_energy_dhw_consumption, this.KNXEventHandler);
    }
    if (settings.ga_energy_heating_consumption) {
      this.knxInterface.removeKNXEventListener(settings.ga_energy_heating_consumption, this.KNXEventHandler);
    }

    this.log('✅ All KNX unsubscriptions completed');
  }

}

module.exports = KNXHeatpumpDevice;
