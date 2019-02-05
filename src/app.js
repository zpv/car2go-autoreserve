require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const autoreserve = require('./handlers/autoreserve');

const app = express();
app.use(bodyParser.json());

app.get('/', (req, res) => {
  res.send('C2G Autoreserver');
});

app.post('/autoreserve', autoreserve);

// eslint-disable-next-line no-console
app.listen(process.env.PORT, () => console.log('C2G Automation Server Started'));
