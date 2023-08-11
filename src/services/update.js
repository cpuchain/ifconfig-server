const { updateDB } = require('./maxmind');
const { updateTor } = require('./torlist');
const { updateAsn } = require('./asnlist');

// Try updater (no need to catch error since those functions catch error themselves);
const updater = async () => {
  await updateDB();
  await updateTor();
  await updateAsn();
};

module.exports = updater;