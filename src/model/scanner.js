const { kdTree: KdTree } = require('kd-tree-javascript');
const { Client } = require('./client');
const { calcDistance } = require('../utils/geo');
const log = require('../utils/log')('Scanner');

const C2G_VEHICLELIST_TOPIC = 'C2G/S2C/4/VEHICLELIST.GZ';
const C2G_VEHICLELIST_DELTA_TOPIC = 'C2G/S2C/4/VEHICLELISTDELTA.GZ';

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

  /**
   * Builds initial KdTree
   * @param {*} vehicles
  */
  _onReceiveVehicleList(data) { // initial build
    this.scannerClient.unsubscribe(C2G_VEHICLELIST_TOPIC);
    const points = [];

    data.connectedVehicles.forEach((vehicle) => {
      points.push(this._buildPointFromVehicle(vehicle));
    });

    this.tree = new KdTree(points, calcDistance, ['latitude', 'longitude']);
  }

  /**
   * Build point in KdTree
   * @param {*} data
  */
  _buildPointFromVehicle(vehicle) {
    const {
      id,
      geoCoordinate: {
        latitude,
        longitude,
      },
    } = vehicle;

    const vehicleData = {
      id,
      latitude,
      longitude,
    };

    this.treeMap[id] = vehicleData;

    return vehicleData;
  }

  /**
   * Performs actions when list of vehicles changes
   * @param {*} data
  */
  _onReceiveVehicleDelta(data) {
    log('PING');
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
      const nearest = this.tree.nearest(location, 1, 2);
      if (nearest.length !== 0) {
        this.clients.delete(client);
        this.reserveCar(client, nearest[0][0].id);
      }
    });
  }

  _onReceiveAccountUpdate(data) {
    log(data);
  }

  addClient(client, location) {
    const { latitude, longitude } = location;
    log(`Client (${client.account.username}) [lat: ${latitude} lon: ${longitude}] connected`);
    this.clients.set(client, location);
  }

  /**
   * Request reservation of provided `vehicle`
   * @param {*} vehicles
  */
  async reserveCar(client, vehicleId) {
    log(`(${client.account.clientId}) Reserving ${vehicleId}`);

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
