const crypto = require('crypto').webcrypto;
const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');
const util = require('util');
const execAsync = util.promisify(require('child_process').exec);
const tar = require('tar');
const commandExists = require('command-exists').sync;
const fetch = require('../libs/fetch');
const { getDBRoot, getDBPath, getTarPath } = require('./filesystem');
const { consoleLog, consoleError } = require('../libs/log');
const { sleep } = require('../libs');

const isTarAvailable = commandExists('tar');

/**
 * Lookup function
 *
 * return example:
 * console.log(lookup('8.8.8.8'));
 * {
 *   ip: '8.8.8.8',
 *   country: 'United States',
 *   iso_code: 'US',
 *   registeredCountry: 'United States',
 *   city: 'Los Angeles',
 *   latitude: 34.0544,
 *   longitude: -118.2441,
 *   timezone: 'America/Los_Angeles',
 *   asn: 'AS15169',
 *   asn_org: 'GOOGLE'
 * }
 * console.log(lookup('1.1.1.1'));
 * {
 *   ip: '1.1.1.1',
 *   registeredCountry: 'Australia',
 *   asn: 'AS13335',
 *   asn_org: 'CLOUDFLARENET'
 * }
 * console.log(lookup('127.0.0.1'));
 * {
 *   ip: '127.0.0.1'
 * }
 */

// EU country iso codes
// https://www.yourdictionary.com/articles/europe-country-codes
const EU = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];

const lookupIP = (ip) => {
  try {
    // Use in-memory maxmind DB
    const DB = globalThis.db;

    if (!DB) {
      throw new Error('MaxMind DB not available in memory');
    }

    const countryResult = DB.country.get(ip);
    const cityResult = DB.city.get(ip);
    const asnResult = DB.asn.get(ip);

    const result = {
      ip
    };

    if (countryResult?.country) {
      result.country = countryResult.country.names.en;

      result.country_iso = countryResult.country.iso_code;

      result.country_eu = EU.includes(countryResult.country.iso_code);
    }

    if (countryResult?.registered_country) {
      result.country_registered = countryResult.registered_country.names.en;
    }

    if (cityResult?.city) {
      result.city = cityResult?.city.names.en;
    }

    if (cityResult?.location) {
      const location = cityResult?.location;

      if (location.latitude) {
        result.latitude = location.latitude;
      }

      if (location.longitude) {
        result.longitude = location.longitude;
      }

      if (location.time_zone) {
        result.time_zone = location.time_zone;
      }
    }

    if (asnResult) {
      result.asn = 'AS' + asnResult.autonomous_system_number;
      result.asn_org = asnResult.autonomous_system_organization;
    }

    return result;
  } catch (e) {
    consoleError(`Error while looking up ${ip} from memory`, e);
  }
};

const edition_id = {
  'asn': 'GeoLite2-ASN',
  'city': 'GeoLite2-City',
  'country': 'GeoLite2-Country'
};

const getShaDigest = (fileBytes) => {
  return crypto.subtle.digest('SHA-256', fileBytes)
    .then(d => {
      return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('');
    });
};

const downloadSha = async (database) => {
  const edition = edition_id[database];
  const LICENSE_KEY = globalThis.config?.licenseKey;

  let resp = await fetch(`https://download.maxmind.com/app/geoip_download?edition_id=${edition}&license_key=${LICENSE_KEY}&suffix=tar.gz.sha256`);

  resp = resp.match(/[^\r\n]+/g).filter(r => r)[0];

  const digest = resp.split('  ')[0];
  const fileName = resp.split('  ')[1];
  const updated = parseInt(fileName.replace(`${edition}_`, '').replace('.tar.gz', ''));

  return {
    digest,
    fileName,
    updated
  };
};

let lastUpdated;

const download = async (database) => {
  const edition = edition_id[database];
  const LICENSE_KEY = globalThis.config?.licenseKey;
  const DB_PATHS = getDBPath();
  const TAR_PATHS = getTarPath();

  const dbName = edition + '.mmdb';
  const dbNameDigest = path.join(getDBRoot(), dbName + '.sha256');

  const { digest, fileName, updated } = await downloadSha(database);
  const dbFile = path.join(fileName.split('.')[0], dbName);

  const resp = await fetch(`https://download.maxmind.com/app/geoip_download?edition_id=${edition}&license_key=${LICENSE_KEY}&suffix=tar.gz`);

  const file = new Uint8Array(await resp.arrayBuffer());

  const digested = await getShaDigest(file);

  if (digest !== digested) {
    const errStr = `Wrong digest, wants ${digest} got ${digested} while downloading ${edition} from MaxMind`;
    throw new Error(errStr);
  }

  await fsPromises.writeFile(fileName, Buffer.from(file));

  if (isTarAvailable) {
    await execAsync(`tar -xf ${fileName}`);
  } else {
    consoleLog('Warning: TAR is not installed on system, it is recommended to use the system installed TAR while updating the DB!');
    await tar.x({
      file: fileName
    });
    // Sleep for 1 second to wait until the inflation is finished
    await sleep(1);
  }

  if (!fs.existsSync(dbFile)) {
    const errStr = `${dbFile} doesn't exist!`;
    throw new Error(errStr);
  }

  await fsPromises.copyFile(fileName, TAR_PATHS[database]);
  await fsPromises.copyFile(dbFile, DB_PATHS[database]);
  await fsPromises.writeFile(DB_PATHS[`${database}_sha256`], digest);
  await fsPromises.writeFile(dbNameDigest, await getShaDigest(new Uint8Array(await fsPromises.readFile(DB_PATHS[database]))));
  await sleep(2);
  await fsPromises.rm(fileName);
  await fsPromises.rm(fileName.split('.')[0], { recursive: true, force: true });

  if (updated > lastUpdated) {
    lastUpdated = `${updated}`;
  }

  consoleLog(`Updated ${dbName} to ${updated} version`);
};

const checkUpdate = async (database) => {
  try {
    const DB_PATHS = getDBPath();
    const currentDigest = globalThis.db ? globalThis.db[`${database}_sha256`]
      : fs.existsSync(DB_PATHS[`${database}_sha256`]) ? fs.readFileSync(DB_PATHS[`${database}_sha256`], { encoding: 'utf8' })
        : '';

    const { digest } = await downloadSha(database);

    if (digest === currentDigest) {
      return;
    }

    await download(database);
  } catch (e) {
    consoleError(`Failed to update ${database} maxmind db`, e);
  }
};

const updateDB = async () => {
  const DB_PATHS = getDBPath();
  if (!globalThis.config?.licenseKey) {
    return;
  }
  lastUpdated = parseInt(
    globalThis.db ? globalThis.db.lastUpdate
      : fs.existsSync(DB_PATHS.lastUpdate) ? fs.readFileSync(DB_PATHS.lastUpdate, { encoding: 'utf8' })
        : 0
  );
  await Promise.all(Object.keys(edition_id).map(e => checkUpdate(e)));
  await fsPromises.writeFile(DB_PATHS.lastUpdate, `${lastUpdated}`);
};

module.exports = {
  lookupIP,
  updateDB
};
