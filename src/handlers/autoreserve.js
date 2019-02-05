const fs = require('fs');
const { promisify } = require('util');

const { Account } = require('../model/account');
const { Scanner } = require('../model/scanner');

const readFile = promisify(fs.readFile);

const autoreserveHandler = async (req, res) => {
  const { username, password, lot } = req.body;

  try {
    const account = new Account(username, password);
    await account.init();

    const certificate = await readFile('certs/ca.cer');
    const scanner = new Scanner(account, certificate);

    scanner.connect();
    scanner.reserveCar(lot);

    res.status(200).send();
  } catch (err) {
    res.status(400).send(err.message);
  }
};

module.exports = autoreserveHandler;
