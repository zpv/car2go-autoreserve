const zlib = require('zlib');
const { promisify } = require('util');

const deflate = promisify(zlib.gunzip);

const readMessage = async msg => JSON.parse((await deflate(msg)).toString());

module.exports = { readMessage };
