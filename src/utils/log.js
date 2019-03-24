const logFn = subject => (msg) => {
  console.log(`[${subject}] – ${msg}`);
};

module.exports = logFn;
