const { login, renew } = require('../services/auth');

/**
 * Car2Go Account Model
 * Renew and
 */
class Account {
  constructor(username, password) {
    this.username = username;
    this.password = password;

    this.initialized = false;
  }

  async init() {
    const { accessToken, refreshToken, clientId } = await login(this.username, this.password);
    this.clientId = clientId;

    this.accessToken = accessToken;
    this.refreshToken = refreshToken;

    this.initialized = true;
  }

  async renew() {
    if (!this.initialized) {
      throw new Error('Unable to renew an uninitialized account.');
    }

    const { accessToken, refreshToken, clientId } = await renew(this.refreshToken);
    this.clientId = clientId;

    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }
}

module.exports = { Account };
