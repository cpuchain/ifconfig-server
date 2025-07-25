import path from 'path';
import 'process';
import require$$2 from 'os';
import { fileURLToPath } from 'url';
import require$$0 from 'fs';
import require$$3 from 'crypto';
import * as fs from 'fs/promises';
import { Reader } from 'mmdb-lib';
import 'logger-chain';
import { promisify } from 'util';
import { exec } from 'child_process';
import * as tar from 'tar';
import { sync } from 'command-exists';
import 'net';
import 'fastify';
import '@fastify/cors';
import '@fastify/static';
import '@fastify/view';
import 'ejs';

const pkgJson = {
  "repository": {
    "url": "git+https://github.com/cpuchain/ifconfig-server.git"
  }};

var config = {};

var main = {exports: {}};

var version = "17.2.1";
var require$$4 = {
	version: version};

var hasRequiredMain;

function requireMain () {
	if (hasRequiredMain) return main.exports;
	hasRequiredMain = 1;
	const fs = require$$0;
	const path$1 = path;
	const os = require$$2;
	const crypto = require$$3;
	const packageJson = require$$4;

	const version = packageJson.version;

	// Array of tips to display randomly
	const TIPS = [
	  '🔐 encrypt with Dotenvx: https://dotenvx.com',
	  '🔐 prevent committing .env to code: https://dotenvx.com/precommit',
	  '🔐 prevent building .env in docker: https://dotenvx.com/prebuild',
	  '📡 observe env with Radar: https://dotenvx.com/radar',
	  '📡 auto-backup env with Radar: https://dotenvx.com/radar',
	  '📡 version env with Radar: https://dotenvx.com/radar',
	  '🛠️  run anywhere with `dotenvx run -- yourcommand`',
	  '⚙️  specify custom .env file path with { path: \'/custom/path/.env\' }',
	  '⚙️  enable debug logging with { debug: true }',
	  '⚙️  override existing env vars with { override: true }',
	  '⚙️  suppress all logs with { quiet: true }',
	  '⚙️  write to custom object with { processEnv: myObject }',
	  '⚙️  load multiple .env files with { path: [\'.env.local\', \'.env\'] }'
	];

	// Get a random tip from the tips array
	function _getRandomTip () {
	  return TIPS[Math.floor(Math.random() * TIPS.length)]
	}

	function parseBoolean (value) {
	  if (typeof value === 'string') {
	    return !['false', '0', 'no', 'off', ''].includes(value.toLowerCase())
	  }
	  return Boolean(value)
	}

	function supportsAnsi () {
	  return process.stdout.isTTY // && process.env.TERM !== 'dumb'
	}

	function dim (text) {
	  return supportsAnsi() ? `\x1b[2m${text}\x1b[0m` : text
	}

	const LINE = /(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/mg;

	// Parse src into an Object
	function parse (src) {
	  const obj = {};

	  // Convert buffer to string
	  let lines = src.toString();

	  // Convert line breaks to same format
	  lines = lines.replace(/\r\n?/mg, '\n');

	  let match;
	  while ((match = LINE.exec(lines)) != null) {
	    const key = match[1];

	    // Default undefined or null to empty string
	    let value = (match[2] || '');

	    // Remove whitespace
	    value = value.trim();

	    // Check if double quoted
	    const maybeQuote = value[0];

	    // Remove surrounding quotes
	    value = value.replace(/^(['"`])([\s\S]*)\1$/mg, '$2');

	    // Expand newlines if double quoted
	    if (maybeQuote === '"') {
	      value = value.replace(/\\n/g, '\n');
	      value = value.replace(/\\r/g, '\r');
	    }

	    // Add to object
	    obj[key] = value;
	  }

	  return obj
	}

	function _parseVault (options) {
	  options = options || {};

	  const vaultPath = _vaultPath(options);
	  options.path = vaultPath; // parse .env.vault
	  const result = DotenvModule.configDotenv(options);
	  if (!result.parsed) {
	    const err = new Error(`MISSING_DATA: Cannot parse ${vaultPath} for an unknown reason`);
	    err.code = 'MISSING_DATA';
	    throw err
	  }

	  // handle scenario for comma separated keys - for use with key rotation
	  // example: DOTENV_KEY="dotenv://:key_1234@dotenvx.com/vault/.env.vault?environment=prod,dotenv://:key_7890@dotenvx.com/vault/.env.vault?environment=prod"
	  const keys = _dotenvKey(options).split(',');
	  const length = keys.length;

	  let decrypted;
	  for (let i = 0; i < length; i++) {
	    try {
	      // Get full key
	      const key = keys[i].trim();

	      // Get instructions for decrypt
	      const attrs = _instructions(result, key);

	      // Decrypt
	      decrypted = DotenvModule.decrypt(attrs.ciphertext, attrs.key);

	      break
	    } catch (error) {
	      // last key
	      if (i + 1 >= length) {
	        throw error
	      }
	      // try next key
	    }
	  }

	  // Parse decrypted .env string
	  return DotenvModule.parse(decrypted)
	}

	function _warn (message) {
	  console.error(`[dotenv@${version}][WARN] ${message}`);
	}

	function _debug (message) {
	  console.log(`[dotenv@${version}][DEBUG] ${message}`);
	}

	function _log (message) {
	  console.log(`[dotenv@${version}] ${message}`);
	}

	function _dotenvKey (options) {
	  // prioritize developer directly setting options.DOTENV_KEY
	  if (options && options.DOTENV_KEY && options.DOTENV_KEY.length > 0) {
	    return options.DOTENV_KEY
	  }

	  // secondary infra already contains a DOTENV_KEY environment variable
	  if (process.env.DOTENV_KEY && process.env.DOTENV_KEY.length > 0) {
	    return process.env.DOTENV_KEY
	  }

	  // fallback to empty string
	  return ''
	}

	function _instructions (result, dotenvKey) {
	  // Parse DOTENV_KEY. Format is a URI
	  let uri;
	  try {
	    uri = new URL(dotenvKey);
	  } catch (error) {
	    if (error.code === 'ERR_INVALID_URL') {
	      const err = new Error('INVALID_DOTENV_KEY: Wrong format. Must be in valid uri format like dotenv://:key_1234@dotenvx.com/vault/.env.vault?environment=development');
	      err.code = 'INVALID_DOTENV_KEY';
	      throw err
	    }

	    throw error
	  }

	  // Get decrypt key
	  const key = uri.password;
	  if (!key) {
	    const err = new Error('INVALID_DOTENV_KEY: Missing key part');
	    err.code = 'INVALID_DOTENV_KEY';
	    throw err
	  }

	  // Get environment
	  const environment = uri.searchParams.get('environment');
	  if (!environment) {
	    const err = new Error('INVALID_DOTENV_KEY: Missing environment part');
	    err.code = 'INVALID_DOTENV_KEY';
	    throw err
	  }

	  // Get ciphertext payload
	  const environmentKey = `DOTENV_VAULT_${environment.toUpperCase()}`;
	  const ciphertext = result.parsed[environmentKey]; // DOTENV_VAULT_PRODUCTION
	  if (!ciphertext) {
	    const err = new Error(`NOT_FOUND_DOTENV_ENVIRONMENT: Cannot locate environment ${environmentKey} in your .env.vault file.`);
	    err.code = 'NOT_FOUND_DOTENV_ENVIRONMENT';
	    throw err
	  }

	  return { ciphertext, key }
	}

	function _vaultPath (options) {
	  let possibleVaultPath = null;

	  if (options && options.path && options.path.length > 0) {
	    if (Array.isArray(options.path)) {
	      for (const filepath of options.path) {
	        if (fs.existsSync(filepath)) {
	          possibleVaultPath = filepath.endsWith('.vault') ? filepath : `${filepath}.vault`;
	        }
	      }
	    } else {
	      possibleVaultPath = options.path.endsWith('.vault') ? options.path : `${options.path}.vault`;
	    }
	  } else {
	    possibleVaultPath = path$1.resolve(process.cwd(), '.env.vault');
	  }

	  if (fs.existsSync(possibleVaultPath)) {
	    return possibleVaultPath
	  }

	  return null
	}

	function _resolveHome (envPath) {
	  return envPath[0] === '~' ? path$1.join(os.homedir(), envPath.slice(1)) : envPath
	}

	function _configVault (options) {
	  const debug = parseBoolean(process.env.DOTENV_CONFIG_DEBUG || (options && options.debug));
	  const quiet = parseBoolean(process.env.DOTENV_CONFIG_QUIET || (options && options.quiet));

	  if (debug || !quiet) {
	    _log('Loading env from encrypted .env.vault');
	  }

	  const parsed = DotenvModule._parseVault(options);

	  let processEnv = process.env;
	  if (options && options.processEnv != null) {
	    processEnv = options.processEnv;
	  }

	  DotenvModule.populate(processEnv, parsed, options);

	  return { parsed }
	}

	function configDotenv (options) {
	  const dotenvPath = path$1.resolve(process.cwd(), '.env');
	  let encoding = 'utf8';
	  let processEnv = process.env;
	  if (options && options.processEnv != null) {
	    processEnv = options.processEnv;
	  }
	  let debug = parseBoolean(processEnv.DOTENV_CONFIG_DEBUG || (options && options.debug));
	  let quiet = parseBoolean(processEnv.DOTENV_CONFIG_QUIET || (options && options.quiet));

	  if (options && options.encoding) {
	    encoding = options.encoding;
	  } else {
	    if (debug) {
	      _debug('No encoding is specified. UTF-8 is used by default');
	    }
	  }

	  let optionPaths = [dotenvPath]; // default, look for .env
	  if (options && options.path) {
	    if (!Array.isArray(options.path)) {
	      optionPaths = [_resolveHome(options.path)];
	    } else {
	      optionPaths = []; // reset default
	      for (const filepath of options.path) {
	        optionPaths.push(_resolveHome(filepath));
	      }
	    }
	  }

	  // Build the parsed data in a temporary object (because we need to return it).  Once we have the final
	  // parsed data, we will combine it with process.env (or options.processEnv if provided).
	  let lastError;
	  const parsedAll = {};
	  for (const path of optionPaths) {
	    try {
	      // Specifying an encoding returns a string instead of a buffer
	      const parsed = DotenvModule.parse(fs.readFileSync(path, { encoding }));

	      DotenvModule.populate(parsedAll, parsed, options);
	    } catch (e) {
	      if (debug) {
	        _debug(`Failed to load ${path} ${e.message}`);
	      }
	      lastError = e;
	    }
	  }

	  const populated = DotenvModule.populate(processEnv, parsedAll, options);

	  // handle user settings DOTENV_CONFIG_ options inside .env file(s)
	  debug = parseBoolean(processEnv.DOTENV_CONFIG_DEBUG || debug);
	  quiet = parseBoolean(processEnv.DOTENV_CONFIG_QUIET || quiet);

	  if (debug || !quiet) {
	    const keysCount = Object.keys(populated).length;
	    const shortPaths = [];
	    for (const filePath of optionPaths) {
	      try {
	        const relative = path$1.relative(process.cwd(), filePath);
	        shortPaths.push(relative);
	      } catch (e) {
	        if (debug) {
	          _debug(`Failed to load ${filePath} ${e.message}`);
	        }
	        lastError = e;
	      }
	    }

	    _log(`injecting env (${keysCount}) from ${shortPaths.join(',')} ${dim(`-- tip: ${_getRandomTip()}`)}`);
	  }

	  if (lastError) {
	    return { parsed: parsedAll, error: lastError }
	  } else {
	    return { parsed: parsedAll }
	  }
	}

	// Populates process.env from .env file
	function config (options) {
	  // fallback to original dotenv if DOTENV_KEY is not set
	  if (_dotenvKey(options).length === 0) {
	    return DotenvModule.configDotenv(options)
	  }

	  const vaultPath = _vaultPath(options);

	  // dotenvKey exists but .env.vault file does not exist
	  if (!vaultPath) {
	    _warn(`You set DOTENV_KEY but you are missing a .env.vault file at ${vaultPath}. Did you forget to build it?`);

	    return DotenvModule.configDotenv(options)
	  }

	  return DotenvModule._configVault(options)
	}

	function decrypt (encrypted, keyStr) {
	  const key = Buffer.from(keyStr.slice(-64), 'hex');
	  let ciphertext = Buffer.from(encrypted, 'base64');

	  const nonce = ciphertext.subarray(0, 12);
	  const authTag = ciphertext.subarray(-16);
	  ciphertext = ciphertext.subarray(12, -16);

	  try {
	    const aesgcm = crypto.createDecipheriv('aes-256-gcm', key, nonce);
	    aesgcm.setAuthTag(authTag);
	    return `${aesgcm.update(ciphertext)}${aesgcm.final()}`
	  } catch (error) {
	    const isRange = error instanceof RangeError;
	    const invalidKeyLength = error.message === 'Invalid key length';
	    const decryptionFailed = error.message === 'Unsupported state or unable to authenticate data';

	    if (isRange || invalidKeyLength) {
	      const err = new Error('INVALID_DOTENV_KEY: It must be 64 characters long (or more)');
	      err.code = 'INVALID_DOTENV_KEY';
	      throw err
	    } else if (decryptionFailed) {
	      const err = new Error('DECRYPTION_FAILED: Please check your DOTENV_KEY');
	      err.code = 'DECRYPTION_FAILED';
	      throw err
	    } else {
	      throw error
	    }
	  }
	}

	// Populate process.env with parsed values
	function populate (processEnv, parsed, options = {}) {
	  const debug = Boolean(options && options.debug);
	  const override = Boolean(options && options.override);
	  const populated = {};

	  if (typeof parsed !== 'object') {
	    const err = new Error('OBJECT_REQUIRED: Please check the processEnv argument being passed to populate');
	    err.code = 'OBJECT_REQUIRED';
	    throw err
	  }

	  // Set process.env
	  for (const key of Object.keys(parsed)) {
	    if (Object.prototype.hasOwnProperty.call(processEnv, key)) {
	      if (override === true) {
	        processEnv[key] = parsed[key];
	        populated[key] = parsed[key];
	      }

	      if (debug) {
	        if (override === true) {
	          _debug(`"${key}" is already defined and WAS overwritten`);
	        } else {
	          _debug(`"${key}" is already defined and was NOT overwritten`);
	        }
	      }
	    } else {
	      processEnv[key] = parsed[key];
	      populated[key] = parsed[key];
	    }
	  }

	  return populated
	}

	const DotenvModule = {
	  configDotenv,
	  _configVault,
	  _parseVault,
	  config,
	  decrypt,
	  parse,
	  populate
	};

	main.exports.configDotenv = DotenvModule.configDotenv;
	main.exports._configVault = DotenvModule._configVault;
	main.exports._parseVault = DotenvModule._parseVault;
	main.exports.config = DotenvModule.config;
	main.exports.decrypt = DotenvModule.decrypt;
	main.exports.parse = DotenvModule.parse;
	main.exports.populate = DotenvModule.populate;

	main.exports = DotenvModule;
	return main.exports;
}

var envOptions;
var hasRequiredEnvOptions;

function requireEnvOptions () {
	if (hasRequiredEnvOptions) return envOptions;
	hasRequiredEnvOptions = 1;
	// ../config.js accepts options via environment variables
	const options = {};

	if (process.env.DOTENV_CONFIG_ENCODING != null) {
	  options.encoding = process.env.DOTENV_CONFIG_ENCODING;
	}

	if (process.env.DOTENV_CONFIG_PATH != null) {
	  options.path = process.env.DOTENV_CONFIG_PATH;
	}

	if (process.env.DOTENV_CONFIG_QUIET != null) {
	  options.quiet = process.env.DOTENV_CONFIG_QUIET;
	}

	if (process.env.DOTENV_CONFIG_DEBUG != null) {
	  options.debug = process.env.DOTENV_CONFIG_DEBUG;
	}

	if (process.env.DOTENV_CONFIG_OVERRIDE != null) {
	  options.override = process.env.DOTENV_CONFIG_OVERRIDE;
	}

	if (process.env.DOTENV_CONFIG_DOTENV_KEY != null) {
	  options.DOTENV_KEY = process.env.DOTENV_CONFIG_DOTENV_KEY;
	}

	envOptions = options;
	return envOptions;
}

var cliOptions;
var hasRequiredCliOptions;

function requireCliOptions () {
	if (hasRequiredCliOptions) return cliOptions;
	hasRequiredCliOptions = 1;
	const re = /^dotenv_config_(encoding|path|quiet|debug|override|DOTENV_KEY)=(.+)$/;

	cliOptions = function optionMatcher (args) {
	  const options = args.reduce(function (acc, cur) {
	    const matches = cur.match(re);
	    if (matches) {
	      acc[matches[1]] = matches[2];
	    }
	    return acc
	  }, {});

	  if (!('quiet' in options)) {
	    options.quiet = 'true';
	  }

	  return options
	};
	return cliOptions;
}

var hasRequiredConfig;

function requireConfig () {
	if (hasRequiredConfig) return config;
	hasRequiredConfig = 1;
	(function () {
	  requireMain().config(
	    Object.assign(
	      {},
	      requireEnvOptions(),
	      requireCliOptions()(process.argv)
	    )
	  );
	})();
	return config;
}

requireConfig();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const viewsDir = path.join(__dirname, "../views");

const EU = ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE"];
function buildResult(CountryDB, CityDB, ASNDB, TorDB, BadAsnDB, ip) {
  const countryResult = CountryDB.get(ip);
  const cityResult = CityDB.get(ip);
  const asnResult = ASNDB.get(ip);
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
    result.city = cityResult.city.names.en;
  }
  if (cityResult?.location) {
    const location = cityResult.location;
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
    result.asn = "AS" + asnResult.autonomous_system_number;
    result.asn_org = asnResult.autonomous_system_organization;
  }
  result.tor = TorDB.has(ip);
  result.bad_asn = result.asn ? BadAsnDB.has(result.asn) : void 0;
  return result;
}
async function readIP(dbRoot, ips) {
  const files = await Promise.all([
    fs.readFile(path.join(dbRoot, "GeoLite2-Country.mmdb")),
    fs.readFile(path.join(dbRoot, "GeoLite2-City.mmdb")),
    fs.readFile(path.join(dbRoot, "GeoLite2-ASN.mmdb")),
    fs.readFile(path.join(dbRoot, "torlist.json"), { encoding: "utf8" }),
    fs.readFile(path.join(dbRoot, "asnlist.json"), { encoding: "utf8" })
  ]);
  const CountryDB = new Reader(files[0]);
  const CityDB = new Reader(files[1]);
  const ASNDB = new Reader(files[2]);
  const TorDB = new Set(JSON.parse(files[3]));
  const BadAsnDB = new Set(JSON.parse(files[4]));
  return ips.map((ip) => buildResult(CountryDB, CityDB, ASNDB, TorDB, BadAsnDB, ip));
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const execAsync = promisify(exec);
const isTarAvailable = sync("tar");
const edition_id = {
  asn: "GeoLite2-ASN",
  city: "GeoLite2-City",
  country: "GeoLite2-Country"
};
async function existsAsync(file) {
  try {
    await fs.stat(file);
    return true;
  } catch {
    return false;
  }
}
async function move(oldPath, newPath) {
  try {
    await fs.rename(oldPath, newPath);
  } catch (err) {
    if (err.code === "EXDEV") {
      await fs.copyFile(oldPath, newPath);
      await fs.rm(oldPath, { force: true });
    } else {
      throw err;
    }
  }
}
function getShaDigest(fileBytes) {
  return crypto.subtle.digest("SHA-256", fileBytes).then((d) => {
    return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
  });
}
async function readSha(database, updater) {
  const {
    config: { dbRoot }
  } = updater;
  const edition = edition_id[database];
  const digestPath = path.join(dbRoot, `${edition}.tar.gz.sha256`);
  if (!await existsAsync(digestPath)) {
    const error = `Path ${digestPath} for ${database} doesn't exists`;
    throw new Error(error);
  }
  return await fs.readFile(digestPath, { encoding: "utf8" });
}
async function downloadSha(database, licenseKey) {
  const edition = edition_id[database];
  let resp = await (await fetch(
    `https://download.maxmind.com/app/geoip_download?edition_id=${edition}&license_key=${licenseKey}&suffix=tar.gz.sha256`
  )).text();
  resp = resp.match(/[^\r\n]+/g)?.filter((r) => r)[0];
  const digest = resp.split("  ")[0];
  const gzFile = resp.split("  ")[1];
  if (!digest || !gzFile) {
    throw new Error(resp);
  }
  const dbVersion = parseInt(gzFile.replace(`${edition}_`, "").replace(".tar.gz", ""));
  return {
    digest,
    gzFile,
    dbVersion
  };
}
async function extractDB(database, gzFile, digest, updater) {
  const {
    config: { dbRoot },
    logger
  } = updater;
  const edition = edition_id[database];
  if (isTarAvailable) {
    await execAsync(`tar -xf ${gzFile}`);
  } else {
    logger.warning(
      "Warning: TAR is not installed on system, it is recommended to use the system installed TAR while updating the DB!"
    );
    await tar.x({
      file: gzFile
    });
    await sleep(1e3);
  }
  const dbFile = path.join(gzFile.split(".")[0], `${edition}.mmdb`);
  if (!await existsAsync(dbFile)) {
    const error = `Error while extracting DB: ${dbFile} doesn't exist!`;
    throw new Error(error);
  }
  await move(gzFile, path.join(dbRoot, `${edition}.tar.gz`));
  await move(dbFile, path.join(dbRoot, `${edition}.mmdb`));
  await fs.writeFile(path.join(dbRoot, `${edition}.tar.gz.sha256`), digest);
  await fs.rm(gzFile.split(".")[0], { recursive: true, force: true });
}
async function downloadDB(database, updater) {
  const {
    config: { licenseKey }
  } = updater;
  const edition = edition_id[database];
  const { digest, gzFile, dbVersion } = await downloadSha(database, licenseKey);
  const file = new Uint8Array(
    await (await fetch(
      `https://download.maxmind.com/app/geoip_download?edition_id=${edition}&license_key=${licenseKey}&suffix=tar.gz`
    )).arrayBuffer()
  );
  const fileHash = await getShaDigest(file);
  if (digest !== fileHash) {
    const error = `Wrong digest, wants ${digest} got ${fileHash} while downloading ${gzFile} from MaxMind`;
    throw new Error(error);
  }
  await fs.writeFile(gzFile, Buffer.from(file));
  await extractDB(database, gzFile, digest, updater);
  return {
    edition,
    digest,
    gzFile,
    dbVersion
  };
}
async function updateDB(database, updater) {
  const { logger } = updater;
  if (!updater.config.licenseKey) {
    throw new Error("License Key not found");
  }
  const [currentDigest, { digest: fetchedDigest }] = await Promise.all([
    readSha(database, updater),
    downloadSha(database, updater.config.licenseKey)
  ]);
  if (currentDigest === fetchedDigest) {
    return;
  }
  const { edition, digest, gzFile, dbVersion } = await downloadDB(database, updater);
  logger.debug(`Updated ${edition} DB to ${dbVersion} (Digest: ${digest})`);
  return {
    edition,
    digest,
    gzFile,
    dbVersion
  };
}
async function fetchExitNodes() {
  const resp = await (await fetch("https://check.torproject.org/torbulkexitlist")).text();
  const list = resp.match(/[^\r\n]+/g)?.filter((r) => r).sort((a, b) => a.localeCompare(b)) || [];
  return list;
}
async function fetchAsnList() {
  const resp = await (await fetch("https://raw.githubusercontent.com/cpuchain/bad-asn-list/master/bad-asn-list.csv")).text();
  const csv = resp.match(/[^\r\n]+/g)?.filter((r) => r).filter((r) => r != "ASN,Entity") || [];
  const list = csv.map((r) => {
    r = r.split(",")[0];
    if (typeof r === "string") {
      r = r.replaceAll('"', "");
    }
    return "AS" + r;
  });
  return list;
}
async function updateAll(updater) {
  const { config, logger } = updater;
  const torList = await fetchExitNodes();
  await fs.writeFile(path.join(config.dbRoot, "torlist.json"), JSON.stringify(torList));
  logger.debug(`Updated ${torList.length} exit nodes`);
  const asnList = await fetchAsnList();
  await fs.writeFile(path.join(config.dbRoot, "asnlist.json"), JSON.stringify(asnList));
  logger.debug(`Updated ${asnList.length} asns`);
  if (!config.licenseKey) {
    return;
  }
  const allUpdates = (await Promise.all(Object.keys(edition_id).map((e) => updateDB(e, updater)))).filter((e) => e);
  if (!allUpdates.length) {
    return;
  }
  const dbVersion = allUpdates.reduce((acc, curr) => {
    if (acc < curr.dbVersion) {
      acc = curr.dbVersion;
    }
    return acc;
  }, 0);
  await fs.writeFile(path.join(config.dbRoot, "last_update.txt"), String(dbVersion));
  logger.debug(`Updated DB version to ${dbVersion}`);
  return dbVersion;
}
async function setupDB(updater) {
  const { config, logger } = updater;
  if (await existsAsync(path.join(config.dbRoot, "last_update.txt"))) {
    const dbVersion2 = Number(
      await fs.readFile(path.join(config.dbRoot, "last_update.txt"), {
        encoding: "utf8"
      })
    );
    return dbVersion2;
  }
  logger.debug("Setting up DB");
  await fs.mkdir(config.dbRoot, { recursive: true });
  await fs.copyFile(path.join(viewsDir, "./asnlist.json"), path.join(config.dbRoot, "asnlist.json"));
  await fs.copyFile(path.join(viewsDir, "./torlist.json"), path.join(config.dbRoot, "torlist.json"));
  await fs.copyFile(
    path.join(viewsDir, "./GeoLite2-ASN.tar.gz.sha256"),
    path.join(config.dbRoot, "GeoLite2-ASN.tar.gz.sha256")
  );
  await fs.copyFile(
    path.join(viewsDir, "./GeoLite2-City.tar.gz.sha256"),
    path.join(config.dbRoot, "GeoLite2-City.tar.gz.sha256")
  );
  await fs.copyFile(
    path.join(viewsDir, "./GeoLite2-Country.tar.gz.sha256"),
    path.join(config.dbRoot, "GeoLite2-Country.tar.gz.sha256")
  );
  await fs.copyFile(path.join(viewsDir, "./last_update.txt"), path.join(config.dbRoot, "last_update.txt"));
  const dbVersion = Number(
    await fs.readFile(path.join(viewsDir, "./last_update.txt"), {
      encoding: "utf8"
    })
  );
  await fs.copyFile(path.join(viewsDir, "./GeoLite2-ASN.tar.gz"), `GeoLite2-ASN_${dbVersion}.tar.gz`);
  await fs.copyFile(path.join(viewsDir, "./GeoLite2-City.tar.gz"), `GeoLite2-City_${dbVersion}.tar.gz`);
  await fs.copyFile(
    path.join(viewsDir, "./GeoLite2-Country.tar.gz"),
    `GeoLite2-Country_${dbVersion}.tar.gz`
  );
  await extractDB("asn", `GeoLite2-ASN_${dbVersion}.tar.gz`, await readSha("asn", updater), updater);
  await extractDB("city", `GeoLite2-City_${dbVersion}.tar.gz`, await readSha("city", updater), updater);
  await extractDB(
    "country",
    `GeoLite2-Country_${dbVersion}.tar.gz`,
    await readSha("country", updater),
    updater
  );
  logger.debug("DB setup complete");
  return dbVersion;
}

(() => {
  const url = new URL(pkgJson.repository.url);
  return `https://${url.host}${url.pathname.replace(".git", "")}`;
})();
const CLI_USERAGENT = [
  "curl",
  "HTTPie",
  "httpie-go",
  "Wget",
  "fetch libfetch",
  "Go",
  "Go-http-client",
  "ddclient",
  "Mikrotik",
  "xh"
];

export { CLI_USERAGENT, __dirname, downloadDB, downloadSha, existsAsync, extractDB, fetchAsnList, fetchExitNodes, move, readIP, readSha, setupDB, updateAll, updateDB, viewsDir };
