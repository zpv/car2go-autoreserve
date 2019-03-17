const { Account } = require('../model/account');
const { Scanner } = require('../model/scanner');
const { Client } = require('../model/client');

let _scanner;

const getScanner = async () => {
  if (_scanner) { return _scanner; }

  const scannerAccount = new Account(process.env.SCANNER_USER, process.env.SCANNER_PASSWORD);
  await scannerAccount.init();

  _scanner = new Scanner(scannerAccount);
  return _scanner;
};

const autoreserveHandler = async (req, res) => {
  const { username, password, lot } = req.body;

  try {
    const account = new Account(username, password);
    await account.init();

    const client = new Client(account);

    (await getScanner()).addClient(client, lot);

    res.status(200).send();
  } catch (err) {
    res.status(400).send(err.message);
  }
};

getScanner();

module.exports = autoreserveHandler;
