const { Client } = require('./client');

const C2G_VEHICLELIST_TOPIC = 'C2G/S2C/4/VEHICLELIST.GZ';
const C2G_VEHICLELIST_DELTA_TOPIC = 'C2G/S2C/4/VEHICLELISTDELTA.GZ';

const _log = (msg) => {
  console.log(`[Scanner] – ${msg}`);
};
class Scanner {
  constructor(account) {
    const scannerClient = new Client(account);
    this.scannerClient = scannerClient;

    scannerClient.setConnectCallback(
      () => {
        scannerClient.subscribe(C2G_VEHICLELIST_TOPIC, 0, this._onReceiveVehicleList.bind(this));
        scannerClient.subscribe(C2G_VEHICLELIST_DELTA_TOPIC, 1, this._onReceiveVehicleDelta.bind(this));
      },
    );

    this.scannerClient.connect();

    this.clients = new Map();
  }

  _onReceiveVehicleList(data) {
    this.scannerClient.unsubscribe(C2G_VEHICLELIST_TOPIC);
    // this._parseVehicles(data.connectedVehicles);

    // _log(JSON.stringify(data));
  }

  _onReceiveVehicleDelta(data) {
    // _log(JSON.stringify(data));

    data.addedVehicles.forEach((vehicle) => {
      this.clients.forEach((location, client) => {
        // if (location === vehicle.address) {
        this.reserveCar(client, vehicle);
        // }
      });
    });
  }

  _onReceiveAccountUpdate(data) {
    _log(data);
  }

  addClient(client, location) {
    _log(`Client (${client.account.username}) requests ${location}`);
    this.clients.set(client, location);
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

          break;
        }

        case C2G_VEHICLELIST_DELTA_TOPIC: {
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
  async reserveCar(client, vehicle) {
    _log(`(${client.account.clientId}) Reserving ${vehicle.id} at ${vehicle.address}`);

    client.subscribe(`C2G/P2P/${client.account.clientId}.GZ`, 0, (msg) => {
      if (msg.eventType == 'BOOKING_RESPONSE') {
        client.close();
      }
    });

    client.publish(`C2G/C2S/11/${client.account.clientId}/REQUESTBOOKING`, {
      locationId: 11,
      targetVehicle: vehicle.id,
      timestamp: Math.round((new Date()).getTime() / 1000),
    });
  }
}

module.exports.Scanner = Scanner;
