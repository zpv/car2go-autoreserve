const mqtt = require('mqtt');
const { readMessage } = require('../lib/mqtt_helper');

const C2G_BROKER_ADDRESS = 'driver.na.car2go.com';
const C2G_VEHICLELIST_TOPIC = 'C2G/S2C/4/VEHICLELIST.GZ';
const C2G_VEHICLELIST_DELTA_TOPIC = 'C2G/S2C/4/VEHICLELISTDELTA.GZ';

class Scanner {
  constructor(account) {
    this.account = account;
  }

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
      this.client.subscribe(C2G_VEHICLELIST_TOPIC, { qos: 0 }, () => {
      });

      this.client.subscribe(C2G_VEHICLELIST_DELTA_TOPIC, { qos: 1 }, () => {
      });

      this.client.subscribe(`C2G/P2P/${this.account.clientId}.GZ`, { qos: 1 }, () => {
      });
    });
  }

  close() {
    this.client.end();
  }

  scan(lot) {
    this.client.on('message', async (topic, message) => {
      // message is Buffer
      if (topic === C2G_VEHICLELIST_TOPIC) {
        this.client.unsubscribe(C2G_VEHICLELIST_TOPIC, () => {
        });

        const vehicleRaw = await readMessage(message);

        vehicleRaw.connectedVehicles.forEach((vehicle) => {
          if (lot === vehicle.address) {
            this.reserveCar(vehicle);
          }
        });
      } else if (topic === C2G_VEHICLELIST_DELTA_TOPIC) {
        const vehicleDeltas = await readMessage(message);
        await Promise.all(vehicleDeltas.addedVehicles.map(async (vehicle) => {
          if (lot === vehicle.address) {
            this.reserveCar(vehicle);
          }
        }));
      } else if (topic === `C2G/P2P/${this.account.clientId}.GZ`) {
        const msg = await readMessage(message);

        if (msg.eventType === 'BOOKING_RESPONSE') {
          this.close();
        }
      }
    });
  }

  async reserveCar(vehicle) {
    console.log(`Reserving ${vehicle.id} at ${vehicle.address}`);

    this.client.publish(`C2G/C2S/11/${this.account.clientId}/REQUESTBOOKING`, JSON.stringify({
      locationId: 11,
      targetVehicle: vehicle.id,
      jwt: this.account.accessToken,
      mqttClientId: this.account.clientId,
      timestamp: Math.round((new Date()).getTime() / 1000),
    }));
  }
}

module.exports.Scanner = Scanner;
