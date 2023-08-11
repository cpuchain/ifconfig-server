const fs = require('fs');
const fetch = require('../libs/fetch');
const { Response } = require('cross-fetch');
const { getDBPath } = require('./filesystem');
const { consoleLog, consoleError } = require('../libs/log');

/**
 *  Fetch Bad ASN list 
 * 
 *  https://github.com/brianhama/bad-asn-list
 */
const fetchAsnList = async () => {
  let resp = await fetch('https://raw.githubusercontent.com/ifconfigla/bad-asn-list/master/bad-asn-list.csv');
  // Since tor api doesn't have Content-Type header it will need to be parsed as string
  if (resp instanceof Response) {
    resp = await resp.text();
  }
  // Parse text list to array
  resp = resp.match(/[^\r\n]+/g).filter(r => r).filter(r => r != 'ASN,Entity');

  // Format CSV to ASN list
  resp = resp.map(r => {
    r = r.split(',')[0];

    if (typeof r === 'string') {
      r = parseInt(r.replaceAll('"', ''));
    }

    return 'AS' + r;
  });

  return resp;
};

const updateAsn = async () => {
  try {
    const DB_PATH = getDBPath().bad_asn;
    const asnList = await fetchAsnList();
    
    fs.writeFileSync(DB_PATH, JSON.stringify(asnList));
    consoleLog(`Updated ${asnList.length} bad asn lists`);
  } catch (e) {
    consoleError('Error while updating bad asn lists', e);
  }
};

const checkAsn = (asn) => {
  if (!globalThis.db?.bad_asn) {
    throw new Error('ASN DB not available in memory');
  }

  return globalThis.db.bad_asn.includes(asn);
};

module.exports = {
  updateAsn,
  checkAsn
};