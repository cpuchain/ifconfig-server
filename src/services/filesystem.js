const fs = require('fs');
const path = require('path');
const process = require('process');
const os = require('os');
const { pipeline } = require('stream/promises');
const maxmind = require('maxmind');
const { sleep } = require('../libs');
const { consoleLog, consoleError } = require('../libs/log');

const isWin = process.platform === 'win32';

// Default DIR: /home/homeuser/.ifconfig
const getDBRoot = () => globalThis.config?.rootDir ?? path.join(os.homedir(), isWin ? './ifconfig' : './.ifconfig');

const getDBPath = () => {
  const DB_ROOT = getDBRoot();

  return {
    country: path.join(DB_ROOT, './GeoLite2-Country.mmdb'),
    country_sha256: path.join(DB_ROOT, './GeoLite2-Country.tar.gz.sha256'),
    city: path.join(DB_ROOT, './GeoLite2-City.mmdb'),
    city_sha256: path.join(DB_ROOT, './GeoLite2-City.tar.gz.sha256'),
    asn: path.join(DB_ROOT, './GeoLite2-ASN.mmdb'),
    asn_sha256: path.join(DB_ROOT, './GeoLite2-ASN.tar.gz.sha256'),
    lastUpdate: path.join(DB_ROOT, 'last_update.txt'),
    tor: path.join(DB_ROOT, './torlist.json'),
    bad_asn: path.join(DB_ROOT, './asnlist.json')
  };
};

const getTarPath = () => {
  const DB_ROOT = getDBRoot();

  return {
    country: path.join(DB_ROOT, './GeoLite2-Country.tar.gz'),
    city: path.join(DB_ROOT, './GeoLite2-City.tar.gz'),
    asn: path.join(DB_ROOT, './GeoLite2-ASN.tar.gz')
  };
};

const getPortPath = () => {
  const DB_ROOT = getDBRoot();

  return path.join(DB_ROOT, 'stats_port.txt');
};

/**
 * Getting files recursively
 * https://stackoverflow.com/questions/5827612/node-js-fs-readdir-recursive-directory-search
 * @param {string} dir
 * @returns {String[]} list of files
 */
const getFiles = (dir) => {
  const dirents = fs.readdirSync(dir, { withFileTypes: true });

  const files = dirents.map((dirent) => {
    const res = path.join(dir, dirent.name);
    return dirent.isDirectory() ? getFiles(res) : res;
  });

  // Return posix path
  return files.flat().map(f => f.split(path.sep).join(path.posix.sep));
};

// Maxmind keys from DB_PATHS object
const MAXMIND = ['country', 'city', 'asn'];
const MAXMIND_DIGEST = MAXMIND.map(m => m + '_sha256');

const initDir = (dir) => {
  const fileName = path.basename(dir);

  if (!fs.existsSync(dir)) {
    try {
      consoleLog(`Initializing ${fileName} directory`);

      fs.mkdirSync(dir);
    } catch (e) {
      consoleError(`Failed to initialize ${fileName} directory`, e);
    }
  }
};

const copyAsync = (srcFile, dstFile) => pipeline(fs.createReadStream(srcFile), fs.createWriteStream(dstFile));

const initFile = async (srcFile, dstFile) => {
  if (!fs.existsSync(dstFile)) {
    try {
      consoleLog(`Initializing ${srcFile} db`);

      await copyAsync(srcFile, dstFile);
    } catch (e) {
      consoleError(`Failed to initialize ${srcFile} db`, e);
    }
  }
};

const initPort = () => {
  const portPath = getPortPath();

  if (globalThis.config?.port) {
    fs.writeFileSync(portPath, `${globalThis.config.statsPort}`);
  }
};

const initDB = async () => {
  const DB_ROOT = getDBRoot();

  const VIEWS_ROOT = path.join(__dirname, '../../views');
  const files = getFiles(VIEWS_ROOT).map(f => f.split('views/')[1]);

  // Create database dir if it doesn't exists
  initDir(DB_ROOT);
  // Create CSS directory
  initDir(path.join(DB_ROOT, 'css'));
  initDir(path.join(DB_ROOT, 'css', 'fonts'));

  await Promise.all(files.map(f => {
    initFile(path.join(VIEWS_ROOT, f), path.join(DB_ROOT, f));
  }));
  initPort();
  await sleep(5);
};

const openDB = async (DB_PATHS, dbName, isUpdate = false) => {
  try {
    if (isUpdate) {
      // Sleep for 5 seconds to wait until file changes settle
      await sleep(10);
    }

    // Update MaxMind DB
    if (MAXMIND.includes(dbName)) {
      globalThis.db[dbName] = await maxmind.open(DB_PATHS[dbName]);
      return;
    }

    // Update MaxMind DB
    if (dbName === 'lastUpdate' || MAXMIND_DIGEST.includes(dbName)) {
      globalThis.db[dbName] = fs.readFileSync(DB_PATHS[dbName], { encoding: 'utf8' });
      return;
    }

    // Update JSON file
    globalThis.db[dbName] = JSON.parse(fs.readFileSync(DB_PATHS[dbName], { encoding: 'utf8' }));

    if (isUpdate) {
      consoleLog(`Updated ${dbName} db from local file changes`);
    }
  } catch (e) {
    consoleError(`Failed to update ${dbName} db`, e);
  }
};

const memDB = async () => {
  const DB_PATHS = getDBPath();
  // Initialize DB object in-memory
  globalThis.db = {};

  // Read main port
  globalThis.STATS_PORT = parseInt(fs.readFileSync(getPortPath(), { encoding: 'utf8' }));

  // Read files and input to memory
  await Promise.all(Object.keys(DB_PATHS).map(dbName => openDB(DB_PATHS, dbName)));

  // Listen for file changes and update
  Object.keys(DB_PATHS).forEach(dbName => {
    // Debounce multiple file change notifications for a period of time
    // https://stackoverflow.com/questions/12978924/fs-watch-fired-twice-when-i-change-the-watched-file
    let fsTimeout;

    fs.watch(DB_PATHS[dbName], () => {
      if (!fsTimeout) {
        openDB(DB_PATHS, dbName, true);
        // give 20 seconds for multiple events
        fsTimeout = setTimeout(() => { fsTimeout = null; }, 20000);
      }
    });
  });
};

const resetDB = () => {
  const DB_ROOT = getDBRoot();

  if (!fs.existsSync(DB_ROOT)) {
    return;
  }

  fs.rmSync(DB_ROOT, { force: true, recursive: true });
  consoleLog('Successfully reset the DB');
};

const checkDB = () => {
  const DB_ROOT = getDBRoot();
  const LAST_UPDATE = path.join(DB_ROOT, 'last_update.txt');

  if (!fs.existsSync(DB_ROOT) || !fs.existsSync(LAST_UPDATE)) {
    consoleLog(`DB does not exist, will initiate DB to ${DB_ROOT}`);
    return;
  }

  const CURRENT_LASTUPDATE = parseInt(fs.readFileSync(LAST_UPDATE, { encoding: 'utf8' }));
  const VIEWS_LASTUPDATE = parseInt(fs.readFileSync(path.join(__dirname, '../../views', 'last_update.txt')));

  consoleLog(`DB version on ${DB_ROOT}: ${CURRENT_LASTUPDATE}, DB version on binary: ${VIEWS_LASTUPDATE}`);

  if (CURRENT_LASTUPDATE >= VIEWS_LASTUPDATE) {
    return;
  }

  consoleLog('DB version is old, will reset the DB');
  resetDB();
};

module.exports = {
  copyAsync,
  getDBRoot,
  getDBPath,
  getTarPath,
  initDB,
  resetDB,
  checkDB,
  memDB
};
