require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const autoreserve = require('./handlers/autoreserve');

const app = express();

app.use(bodyParser.json());

app.get('/', (req, res) => {
  res.send('GET / – C2G Automation Server');
});

app.post('/autoreserve', autoreserve);

app.listen(process.env.PORT || 3000, () => console.log('C2G Automation Server Started'));
