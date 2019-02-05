/* eslint-disable camelcase */

/*
  A reverse engineering project.

  Rebuilt car2go's internal APIs from network sniffing,
  app decompilation, as well as heavy research into the mqtt protocol.
*/

require('dotenv').config();

const mqtt = require('mqtt');
const axios = require('axios');
const fs = require('fs');
const querystring = require('querystring');
const zlib = require('zlib');
const jwtDecode = require('jwt-decode');

const { promisify } = require('util');

const fsExists = promisify(fs.exists);
const fsReadFile = promisify(fs.readFile);
const fsWriteFile = promisify(fs.writeFile);

const deflate = promisify(zlib.gunzip);

const C2G_BROKER_ADDRESS = 'driver.na.car2go.com';
const C2G_AUTH_ADDRESS = 'https://www.car2go.com/auth/realms/c2gcustomer/protocol/openid-connect/token';

let vehicles = {};

const watched_parking_lots = {
  'UBC West Parkade ROOFTOP': true,
  'UBC - 1900 Lowermall road': true,
};

const start = async () => {
  const auth = await renew_auth();

  const client = mqtt.connect({
    host: C2G_BROKER_ADDRESS,
    port: 443,
    protocol: 'mqtts',
    ca: await fsReadFile('certs/ca.cer'),
    clientId: auth.client_id,
    username: auth.client_id,
    password: auth.access_token,
    protocolVersion: 3,
    protocolId: 'MQIsdp',
    rejectUnauthorized: true,
  });

  client.on('connect', () => {
    client.subscribe('C2G/S2C/4/VEHICLELIST.GZ', { qos: 0 }, () => {
    });

    client.subscribe('C2G/S2C/4/VEHICLELISTDELTA.GZ', { qos: 1 }, () => {
    });

    client.subscribe(`C2G/P2P/${auth.client_id}.GZ`, { qos: 1 }, () => {
    });
  });

  client.on('reconnect', () => {
    console.log('reconnect');
  });

  // TODO: make a better auth_token renewal
  client.on('close', async () => {
    console.log('close');
    const { access_token } = await renew_auth(true);
    client.options.password = access_token;
  });

  client.on('error', (e) => {
    console.log('error', e);
  });

  client.on('message', async (topic, message) => {
    // message is Buffer
    if (topic == 'C2G/S2C/4/VEHICLELIST.GZ') {
      client.unsubscribe('C2G/S2C/4/VEHICLELIST.GZ', (_err) => {
        console.log('Unsubscribed from vehicle list.');
      });

      vehicles_raw = JSON.parse((await deflate(message)).toString());

      vehicles = vehicles_raw.connectedVehicles.reduce(async (map, obj) => {
        if (watched_parking_lots[obj.address]) {
          reserve_car(client, obj, (await renew_auth()).access_token, auth.client_id);
        }

        map[obj.id] = obj;
        return map;
      }, {});
    } else if (topic == 'C2G/S2C/4/VEHICLELISTDELTA.GZ') {
      vehicle_deltas = JSON.parse((await deflate(message)).toString());
      await Promise.all(vehicle_deltas.addedVehicles.map(async (v) => {
        vehicles[v.id] = v;
        if (watched_parking_lots[v.address]) {
          reserve_car(client, v, (await renew_auth()).access_token, auth.client_id);
        }
      }));

      vehicle_deltas.removedVehicles.forEach((v) => {
        delete vehicles[v.id];
      });
    } else if (topic == `C2G/P2P/${auth.client_id}.GZ`) {
      msg = JSON.parse((await deflate(message)).toString());
      console.log(msg);
      if (msg.eventType == 'BOOKING_RESPONSE') {
        //  debugger;
      }
    }
  });
};

const reserve_car = async (client, vehicle, jwt, client_id) => {
  console.log(`Subscribing to ${vehicle.id} at ${vehicle.address}`);
  client.publish('C2G/C2S/11/836b7ac7-e8bb-4d3f-b76a-0083e5d9d86f/REQUESTBOOKING', JSON.stringify({
    locationId: 11,
    targetVehicle: vehicle.id,
    jwt,
    mqttClientId: client_id,
    timestamp: Math.round((new Date()).getTime() / 1000),
  }));
};

const renew_auth = async (force_renew) => {
  let auth = {};

  if (await fsExists('auth.json')) {
    auth = JSON.parse(await fsReadFile('auth.json', 'utf8'));
  }

  if (!force_renew) {
    console.log('Loaded authentication.');
    return auth;
  }
  try {
    // TODO: clean this up
    const data = auth.refresh_token
      ? querystring.stringify({
        refresh_token: auth.refresh_token,
        grant_type: 'refresh_token',
      })
      : querystring.stringify({
        username: '',
        grant_type: 'password',
        password: '',
        scope: 'offline_access',
      });

    // TODO: Extract strings
    const response = await axios({
      url: C2G_AUTH_ADDRESS,
      method: 'post',
      headers: {
        'X-CSRFToken': 'Roses are red and violets are blue. Backend expects a value, so that\'s why this is here.',
        Authorization: 'Basic aW9zX2FwcDoxYWRhNGY1NS1hYTZiLTRkOGItOGI4Ny0wNWQ2ODllMThhMWU=',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      data,
    });
    const { access_token, refresh_token } = response.data;
    const client_id = jwtDecode(access_token).uuid;

    auth = { access_token, refresh_token, client_id };

    res = await fsWriteFile('auth.json', JSON.stringify(auth));

    return auth;
  } catch (e) {
    console.error(e.response.data);
  }
};

start();
