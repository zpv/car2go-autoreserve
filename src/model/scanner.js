const mqtt = require('mqtt');
const { readMessage } = require('../lib/mqtt_helper');

const C2G_BROKER_ADDRESS = 'driver.na.car2go.com';
const C2G_VEHICLELIST_TOPIC = 'C2G/S2C/4/VEHICLELIST.GZ';
const C2G_VEHICLELIST_DELTA_TOPIC = 'C2G/S2C/4/VEHICLELISTDELTA.GZ';

class Scanner {
  constructor(account) {
    this.account = account;
  }

  /**
   * Connect to Car2Go broker server using client certificate
   * @param {*} certificate
   */
  connect(certificate) {
    this.client = mqtt.connect({
      host: C2G_BROKER_ADDRESS,
      port: 443,
      protocol: 'mqtts',
      ca: certificate,
      clientId: this.account.clientId,
      username: this.account.clientId,
      password: this.account.accessToken,
      protocolVersion: 3,
      protocolId: 'MQIsdp',
      rejectUnauthorized: true,
    });

    this.client.on('connect', () => {
      this._log('Client connected.');
      this.client.subscribe(C2G_VEHICLELIST_TOPIC, { qos: 0 }, () => {
      });

      this.client.subscribe(C2G_VEHICLELIST_DELTA_TOPIC, { qos: 1 }, () => {
      });

      this.client.subscribe(`C2G/P2P/${this.account.clientId}.GZ`, { qos: 1 }, () => {
      });
    });

    this.client.on('close', async () => {
      this._log('Connection closed.');
      this._log('Renewing authentication...');

      await this.account.renew();
      this.client.options.password = this.account.accessToken;

      this._log('Renewed.');
    });
  }

  close() {
    this.client.end();
  }

  /**
   * Watch and reserve any vehicles available at given `lot`
   * @param {*} lot Parking lot to watch and reserve from
   */
  scan(lot) {
    this.client.on('message', async (topic, message) => {
      // Decompress messsage
      const data = await readMessage(message);

      switch (topic) {
        case C2G_VEHICLELIST_TOPIC: {
          this.client.unsubscribe(C2G_VEHICLELIST_TOPIC, () => {
          });

          this._parseVehicles(data.connectedVehicles, lot);
          break;
        }

        case C2G_VEHICLELIST_DELTA_TOPIC: {
          this._parseVehicles(data.addedVehicles, lot);
          break;
        }

        // Close connection after successful booking
        case `C2G/P2P/${this.account.clientId}.GZ`: {
          if (data.eventType === 'BOOKING_RESPONSE') {
            this.close();
          }
          break;
        }

        default:
          break;
      }
    });
  }

  /**
   * Request reservation of provided `vehicle`
   * @param {*} vehicles
  */
  async reserveCar(vehicle) {
    this._log(`Reserving ${vehicle.id} at ${vehicle.address}`);

    await this.account.renew();

    this.client.publish(`C2G/C2S/11/${this.account.clientId}/REQUESTBOOKING`, JSON.stringify({
      locationId: 11,
      targetVehicle: vehicle.id,
      jwt: this.account.accessToken,
      mqttClientId: this.account.clientId,
      timestamp: Math.round((new Date()).getTime() / 1000),
    }));
  }

  /**
   * Parse `vehicles` list to reserve any vehicle found at given lot
   * @param {*} vehicles
   * @param {*} lot
  */
  _parseVehicles(vehicles, lot) {
    vehicles.some((vehicle) => {
      if (lot === vehicle.address) {
        this.reserveCar(vehicle);
        return true;
      }
      return false;
    });
  }

  _log(msg) {
    console.log(`[${this.account.username}] – ${msg}`);
  }
}

module.exports.Scanner = Scanner;
