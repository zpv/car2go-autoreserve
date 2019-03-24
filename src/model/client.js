const fs = require('fs');
const mqtt = require('mqtt');

const { readMessage } = require('../lib/mqtt_helper');
const log = require('../utils/log')('Client');

const certificate = fs.readFileSync('certs/ca.cer');

const C2G_BROKER_ADDRESS = 'driver.na.car2go.com';

class Client {
  constructor(account) {
    this.account = account;
    this.messageCallbacks = {};
  }

  setConnectCallback(callback) {
    this.connectCallback = callback;
  }

  connect() {
    this.mqttClient = mqtt.connect({
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

    this.mqttClient.on('connect', () => {
      log('Client connected.');

      if (this.connectCallback) {
        this.connectCallback();
      }
    });

    this.mqttClient.on('message', async (topic, message) => {
      const cb = this.messageCallbacks[topic];

      if (cb) {
        const data = await readMessage(message);
        cb(data);
      }
    });

    this.mqttClient.on('close', async () => {
      log('Connection closed.');
      log('Renewing authentication...');

      await this.account.renew();
      this.mqttClient.options.password = this.account.accessToken;

      log('Renewed.');
    });
  }

  subscribe(topic, qos, cb) {
    if (!this.mqttClient || !this.mqttClient.connected) {
      this.connect();
    }

    this.mqttClient.subscribe(topic, { qos }, () => {});

    if (cb) {
      this.messageCallbacks[topic] = cb;
    }
  }

  unsubscribe(topic) {
    this.mqttClient.unsubscribe(topic, () => {});
  }

  async publish(topic, data) {
    if (!this.mqttClient || !this.mqttClient.connected) {
      this.connect();
    }

    await this.account.renew();

    const message = data;
    message.jwt = this.account.accessToken;
    message.mqttClientId = this.account.clientId;

    this.mqttClient.publish(topic, JSON.stringify(message));
  }

  close() {
    this.mqttClient.end();
  }

  log(msg) {
    console.log(`[${this.account.username}] – ${msg}`);
  }
}

module.exports = { Client };
