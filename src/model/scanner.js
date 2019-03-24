const { kdTree } = require('kd-tree-javascript');
const { Client } = require('./client');

const KdTree = kdTree;
const C2G_VEHICLELIST_TOPIC = 'C2G/S2C/4/VEHICLELIST.GZ';
const C2G_VEHICLELIST_DELTA_TOPIC = 'C2G/S2C/4/VEHICLELISTDELTA.GZ';

const calcDistance = (a, b) => {
  const rad = Math.PI / 180;
  let lat1 = a.latiitude;
  const lon1 = a.longitude;
  let lat2 = b.latitude;
  const lon2 = b.longitude;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  lat1 *= rad;
  lat2 *= rad;
  const x = Math.sin(dLat / 2);
  const y = Math.sin(dLon / 2);
  const dist = x * x + y * y * Math.cos(lat1) * Math.cos(lat2);
  return Math.atan2(Math.sqrt(dist), Math.sqrt(1 - dist));
};

const _log = (msg) => {
  console.log(`[Scanner] – ${msg}`);
};
class Scanner {
  constructor(account) {
    const scannerClient = new Client(account);
    this.scannerClient = scannerClient;
    this.tree = null;
    this.treeMap = {};

    scannerClient.setConnectCallback(
      () => {
        scannerClient.subscribe(C2G_VEHICLELIST_TOPIC, 0, this._onReceiveVehicleList.bind(this));
        scannerClient.subscribe(C2G_VEHICLELIST_DELTA_TOPIC, 1, this._onReceiveVehicleDelta.bind(this));
      },
    );

    this.scannerClient.connect();

    this.clients = new Map(); // Client => location
  }

  _onReceiveVehicleList(data) {
    this.scannerClient.unsubscribe(C2G_VEHICLELIST_TOPIC);
    const points = [];

    // initial build
    data.connectedVehicles.forEach((vehicle) => {
      points.push(this._buildPointFromVehicle(vehicle));
    });

    this.tree = new KdTree(points, calcDistance, ['latitude', 'longitude']);
  }

  _buildPointFromVehicle(vehicle) {
    const vehicleData = {
      id: vehicle.id,
      latitude: vehicle.geoCoordinate.latitude,
      longitude: vehicle.geoCoordinate.longitude,
    };

    this.treeMap[vehicle.id] = vehicleData;

    return vehicleData;
  }

  _onReceiveVehicleDelta(data) {
    if (!this.tree) {
      return;
    }

    data.removedVehicles.forEach((vehicle) => {
      const vehicleData = this.treeMap[vehicle];
      this.tree.remove(vehicleData);
      delete this.treeMap[vehicle];
    });

    data.addedVehicles.forEach((vehicle) => {
      this.tree.insert(this._buildPointFromVehicle(vehicle));
    });

    this.clients.forEach((location, client) => {
      const nearest = this.tree.nearest(location, 1);
      if (nearest.length !== 0) {
        this.reserveCar(client, nearest);
      }
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
   * Request reservation of provided `vehicle`
   * @param {*} vehicles
  */
  async reserveCar(client, vehicleId) {
    _log(`(${client.account.clientId}) Reserving ${vehicleId}`);

    client.subscribe(`C2G/P2P/${client.account.clientId}.GZ`, 0, (msg) => {
      if (msg.eventType === 'BOOKING_RESPONSE') {
        client.close();
      }
    });

    client.publish(`C2G/C2S/11/${client.account.clientId}/REQUESTBOOKING`, {
      locationId: 11,
      targetVehicle: vehicleId,
      timestamp: Math.round((new Date()).getTime() / 1000),
    });
  }
}

module.exports.Scanner = Scanner;
