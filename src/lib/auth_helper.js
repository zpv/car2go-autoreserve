const querystring = require('querystring');
const axios = require('axios');
const jwtDecode = require('jwt-decode');

const C2G_AUTH_ENDPOINT = 'https://www.car2go.com/auth/realms/c2gcustomer/protocol/openid-connect/token';
const CSRF_TOKEN = 'Roses are red and violets are blue. Backend expects a value, so that\'s why this is here.';

/**
 * Post to Car2Go Authentication endpoint
 *
 * @param {*} data Query string passed to endpoint
 */
const post = async data => axios({
  url: C2G_AUTH_ENDPOINT,
  method: 'POST',
  headers: {
    Authorization: process.env.AUTH,
    'X-CSRFToken': CSRF_TOKEN,
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  data: querystring.stringify(data),
});

/**
 * Extract authentication information from response.
 * Decodes access JWT to retrieve user UUID.
 *
 * @param {*} response C2G authentication response
 */
const handleAuth = (response) => {
  const accessToken = response.access_token;
  const refreshToken = response.refresh_token;

  const clientId = jwtDecode(accessToken).uuid;

  return { accessToken, refreshToken, clientId };
};

module.exports = { post, handleAuth };
