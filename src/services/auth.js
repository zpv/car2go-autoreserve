// Car2Go Authentication Service

const { post, handleAuth } = require('../lib/auth_helper');

/**
 * Returns refresh and authentication token.
 *
 * @param {*} username
 * @param {*} password
 */

const login = async (username, password) => {
  try {
    const response = (await post({
      username,
      password,
      grant_type: 'password',
      scope: 'offline_access',
    })).data;

    return handleAuth(response);
  } catch (e) {
    throw new Error('Failed to login', e);
  }
};

const renew = async (refreshToken) => {
  try {
    const response = (await post({
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    })).data;

    return handleAuth(response);
  } catch (e) {
    throw new Error('Failed to refresh token', e);
  }
};

module.exports = { login, renew };
