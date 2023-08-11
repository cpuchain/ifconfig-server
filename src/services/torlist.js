const fs = require('fs');
const fetch = require('../libs/fetch');
const { Response } = require('cross-fetch');
const { getDBPath } = require('./filesystem');
const { consoleLog, consoleError } = require('../libs/log');

/**
 *  Fetch TOR exit nodes from official TOR API
 * 
 *  https://blog.torproject.org/changes-tor-exit-list-service/
 */
const fetchExitNodes = async () => {
  let resp = await fetch('https://check.torproject.org/torbulkexitlist');
  // Since tor api doesn't have Content-Type header it will need to be parsed as string
  if (resp instanceof Response) {
    resp = await resp.text();
  }
  // Parse text list to array
  resp = resp.match(/[^\r\n]+/g).filter(r => r);

  return resp;
};

const updateTor = async () => {
  try {
    const DB_PATH = getDBPath().tor;
    const nodes = await fetchExitNodes();

    fs.writeFileSync(DB_PATH, JSON.stringify(nodes));
    consoleLog(`Updated ${nodes.length} tor exit nodes`);
  } catch (e) {
    consoleError('Error while updating tor exit node list', e);
  }
};

const checkTor = (ip) => {
  if (!globalThis.db?.tor) {
    throw new Error('Tor DB not available in memory');
  }

  return globalThis.db.tor.includes(ip);
};

module.exports = {
  updateTor,
  checkTor
};