/* eslint-disable camelcase */

/*
  A reverse engineering project.
  
  Rebuilt car2go's internal APIs from network sniffing,
  app decompilation, as well as heavy research into the mqtt protocol.
*/
const mqtt = require('mqtt');
const axios = require('axios');

const fs = require('fs');
const {promisify} = require('util');
const querystring = require('querystring');

const jwtDecode = require('jwt-decode');

const fsExists = promisify(fs.exists);
const fsReadFile = promisify(fs.readFile);
const fsWriteFile = promisify(fs.writeFile);

const zlib = require('zlib');

const deflate = promisify(zlib.gunzip);

const C2G_BROKER_ADDRESS = 'driver.na.car2go.com';
const C2G_AUTH_ADDRESS = 'https://www.car2go.com/auth/realms/c2gcustomer/protocol/openid-connect/token';

let vehicles = {};

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


  client.on('connect', function() {
    client.subscribe('C2G/S2C/4/VEHICLELIST.GZ', {qos: 0}, (err) => {
      console.log('Subscribed to vehicle list.');
    });

    client.subscribe('C2G/S2C/4/VEHICLELISTDELTA.GZ', {qos: 1}, (err) => {
      console.log('Subscribed to vehicle list deltas');
    });
  });

  client.on('reconnect', function() {
    console.log('reconnect');
  });

  // TODO: make a better auth_token renewal
  client.on('close', async function() {
    console.log('close');
    const {access_token} = await renew_auth(true);
    client.options.password = access_token;
  });

  client.on('error', function(e) {
    console.log('error', e);
  });

  client.on('message', async function(topic, message) {
    // message is Buffer
    if (topic == 'C2G/S2C/4/VEHICLELIST.GZ') {
      vehicles_raw = JSON.parse((await deflate(message)).toString());

      vehicles = vehicles_raw['connectedVehicles'].reduce((map, obj) => {
        map[obj.id] = obj;
        return map;
      }, {});

      client.unsubscribe('C2G/S2C/4/VEHICLELIST.GZ', (_err) => {
        console.log('Unsubscribed from vehicle list.');
      });
    } else if (topic == 'C2G/S2C/4/VEHICLELISTDELTA.GZ') {
      vehicle_deltas = JSON.parse((await deflate(message)).toString());
      vehicle_deltas['addedVehicles'].forEach((v) => {
        vehicles[v.id] = v;
      });

      vehicle_deltas['removedVehicles'].forEach((v) => {
        delete vehicles[v.id];
      });
    }
  });
};


const renew_auth = async (force_renew) => {
  let auth = {};

  if (await fsExists('auth.json')) {
    auth = JSON.parse(await fsReadFile('auth.json', 'utf8'));
  }

  if (!force_renew) {
    console.log('Loaded authentication.');
    return auth;
  } else {
    try {

      // TODO: clean this up
      const data = auth.refresh_token ?
        querystring.stringify({
          refresh_token: auth.refresh_token,
          grant_type: 'refresh_token',
        })
        :
        querystring.stringify({
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
          'Authorization': 'Basic aW9zX2FwcDoxYWRhNGY1NS1hYTZiLTRkOGItOGI4Ny0wNWQ2ODllMThhMWU=',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        data: data,
      });
      const {access_token, refresh_token} = response.data;
      const client_id = jwtDecode(access_token).uuid;

      auth = {access_token, refresh_token, client_id};

      res = await fsWriteFile('auth.json', JSON.stringify(auth));

      return auth;
    } catch (e) {
      console.log(e.response.data);
    }
  }
};

start();
