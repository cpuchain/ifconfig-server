"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.existsAsync = existsAsync;
exports.move = move;
exports.readSha = readSha;
exports.downloadSha = downloadSha;
exports.extractDB = extractDB;
exports.downloadDB = downloadDB;
exports.updateDB = updateDB;
exports.fetchExitNodes = fetchExitNodes;
exports.fetchAsnList = fetchAsnList;
exports.updateAll = updateAll;
exports.setupDB = setupDB;
const util_1 = require("util");
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const fs = __importStar(require("fs/promises"));
const tar_1 = __importDefault(require("tar"));
const command_exists_1 = require("command-exists");
const logger_1 = __importDefault(require("./logger"));
const utils_1 = require("./utils");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
const isTarAvailable = (0, command_exists_1.sync)('tar');
const edition_id = {
    asn: 'GeoLite2-ASN',
    city: 'GeoLite2-City',
    country: 'GeoLite2-Country',
};
function existsAsync(file) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield fs.stat(file);
            return true;
        }
        catch (_a) {
            return false;
        }
    });
}
// https://stackoverflow.com/questions/8579055/how-do-i-move-files-in-node-js
function move(oldPath, newPath) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield fs.rename(oldPath, newPath);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }
        catch (err) {
            if (err.code === 'EXDEV') {
                yield fs.copyFile(oldPath, newPath);
                yield fs.rm(oldPath, { force: true });
            }
            else {
                throw err;
            }
        }
    });
}
function getShaDigest(fileBytes) {
    return crypto.subtle.digest('SHA-256', fileBytes).then((d) => {
        return Array.from(new Uint8Array(d))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
    });
}
function readSha(database, updater) {
    return __awaiter(this, void 0, void 0, function* () {
        const { config: { dbRoot }, } = updater;
        const edition = edition_id[database];
        const digestPath = path_1.default.join(dbRoot, `${edition}.tar.gz.sha256`);
        if (!(yield existsAsync(digestPath))) {
            const error = `Path ${digestPath} for ${database} doesn't exists`;
            throw new Error(error);
        }
        return yield fs.readFile(digestPath, { encoding: 'utf8' });
    });
}
function downloadSha(database, licenseKey) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const edition = edition_id[database];
        let resp = yield (yield fetch(`https://download.maxmind.com/app/geoip_download?edition_id=${edition}&license_key=${licenseKey}&suffix=tar.gz.sha256`)).text();
        // remove line breaks
        resp = (_a = resp.match(/[^\r\n]+/g)) === null || _a === void 0 ? void 0 : _a.filter((r) => r)[0];
        const digest = resp.split('  ')[0];
        const gzFile = resp.split('  ')[1];
        // MaxMind API returns error on plain text string if it is not a digest, so we throw them
        if (!digest || !gzFile) {
            throw new Error(resp);
        }
        const dbVersion = parseInt(gzFile.replace(`${edition}_`, '').replace('.tar.gz', ''));
        return {
            digest,
            gzFile,
            dbVersion,
        };
    });
}
function extractDB(database, gzFile, digest, updater) {
    return __awaiter(this, void 0, void 0, function* () {
        const { config: { dbRoot }, logger, } = updater;
        const edition = edition_id[database];
        if (isTarAvailable) {
            yield execAsync(`tar -xf ${gzFile}`);
        }
        else {
            logger.warning('Warning: TAR is not installed on system, it is recommended to use the system installed TAR while updating the DB!');
            yield tar_1.default.x({
                file: gzFile,
            });
            // Sleep for 1 second to wait until the inflation is finished
            yield (0, utils_1.sleep)(1000);
        }
        // Directory where the db would exist after extraction
        const dbFile = path_1.default.join(gzFile.split('.')[0], `${edition}.mmdb`);
        if (!(yield existsAsync(dbFile))) {
            const error = `Error while extracting DB: ${dbFile} doesn't exist!`;
            throw new Error(error);
        }
        yield move(gzFile, path_1.default.join(dbRoot, `${edition}.tar.gz`));
        yield move(dbFile, path_1.default.join(dbRoot, `${edition}.mmdb`));
        yield fs.writeFile(path_1.default.join(dbRoot, `${edition}.tar.gz.sha256`), digest);
        yield fs.rm(gzFile.split('.')[0], { recursive: true, force: true });
    });
}
function downloadDB(database, updater) {
    return __awaiter(this, void 0, void 0, function* () {
        const { config: { licenseKey }, } = updater;
        const edition = edition_id[database];
        const { digest, gzFile, dbVersion } = yield downloadSha(database, licenseKey);
        const file = new Uint8Array(yield (yield fetch(`https://download.maxmind.com/app/geoip_download?edition_id=${edition}&license_key=${licenseKey}&suffix=tar.gz`)).arrayBuffer());
        const fileHash = yield getShaDigest(file);
        if (digest !== fileHash) {
            const error = `Wrong digest, wants ${digest} got ${fileHash} while downloading ${gzFile} from MaxMind`;
            throw new Error(error);
        }
        yield fs.writeFile(gzFile, Buffer.from(file));
        yield extractDB(database, gzFile, digest, updater);
        return {
            edition,
            digest,
            gzFile,
            dbVersion,
        };
    });
}
function updateDB(database, updater) {
    return __awaiter(this, void 0, void 0, function* () {
        const { logger } = updater;
        if (!updater.config.licenseKey) {
            throw new Error('License Key not found');
        }
        const [currentDigest, { digest: fetchedDigest }] = yield Promise.all([
            readSha(database, updater),
            downloadSha(database, updater.config.licenseKey),
        ]);
        if (currentDigest === fetchedDigest) {
            return;
        }
        const { edition, digest, gzFile, dbVersion } = yield downloadDB(database, updater);
        logger.debug(`Updated ${edition} DB to ${dbVersion} (Digest: ${digest})`);
        return {
            edition,
            digest,
            gzFile,
            dbVersion,
        };
    });
}
function fetchExitNodes() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const resp = yield (yield fetch('https://check.torproject.org/torbulkexitlist')).text();
        // Parse text list to array
        const list = ((_a = resp
            .match(/[^\r\n]+/g)) === null || _a === void 0 ? void 0 : _a.filter((r) => r).sort((a, b) => a.localeCompare(b))) || [];
        return list;
    });
}
function fetchAsnList() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const resp = yield (yield fetch('https://raw.githubusercontent.com/cpuchain/bad-asn-list/master/bad-asn-list.csv')).text();
        // Parse text list to array
        const csv = ((_a = resp
            .match(/[^\r\n]+/g)) === null || _a === void 0 ? void 0 : _a.filter((r) => r).filter((r) => r != 'ASN,Entity')) || [];
        // Format CSV to ASN list
        const list = csv.map((r) => {
            r = r.split(',')[0];
            if (typeof r === 'string') {
                r = r.replaceAll('"', '');
            }
            return 'AS' + r;
        });
        return list;
    });
}
function updateAll(updater) {
    return __awaiter(this, void 0, void 0, function* () {
        const { config, logger } = updater;
        // Update TOR and Bad ASN
        const torList = yield fetchExitNodes();
        yield fs.writeFile(path_1.default.join(config.dbRoot, 'torlist.json'), JSON.stringify(torList));
        logger.debug(`Updated ${torList.length} exit nodes`);
        const asnList = yield fetchAsnList();
        yield fs.writeFile(path_1.default.join(config.dbRoot, 'asnlist.json'), JSON.stringify(asnList));
        logger.debug(`Updated ${asnList.length} asns`);
        // Update MaxMind DB
        if (!config.licenseKey) {
            return;
        }
        const allUpdates = (yield Promise.all(Object.keys(edition_id).map((e) => updateDB(e, updater)))).filter((e) => e);
        if (!allUpdates.length) {
            return;
        }
        const dbVersion = allUpdates.reduce((acc, curr) => {
            if (acc < curr.dbVersion) {
                acc = curr.dbVersion;
            }
            return acc;
        }, 0);
        yield fs.writeFile(path_1.default.join(config.dbRoot, 'last_update.txt'), String(dbVersion));
        logger.debug(`Updated DB version to ${dbVersion}`);
        return dbVersion;
    });
}
function setupDB(updater) {
    return __awaiter(this, void 0, void 0, function* () {
        const { config, logger } = updater;
        if (yield existsAsync(path_1.default.join(config.dbRoot, 'last_update.txt'))) {
            const dbVersion = Number(yield fs.readFile(path_1.default.join(config.dbRoot, 'last_update.txt'), {
                encoding: 'utf8',
            }));
            return dbVersion;
        }
        logger.debug('Setting up DB');
        yield fs.mkdir(config.dbRoot, { recursive: true });
        yield fs.copyFile(path_1.default.join(process.cwd(), './views/asnlist.json'), path_1.default.join(config.dbRoot, 'asnlist.json'));
        yield fs.copyFile(path_1.default.join(process.cwd(), './views/torlist.json'), path_1.default.join(config.dbRoot, 'torlist.json'));
        yield fs.copyFile(path_1.default.join(process.cwd(), './views/GeoLite2-ASN.tar.gz.sha256'), path_1.default.join(config.dbRoot, 'GeoLite2-ASN.tar.gz.sha256'));
        yield fs.copyFile(path_1.default.join(process.cwd(), './views/GeoLite2-City.tar.gz.sha256'), path_1.default.join(config.dbRoot, 'GeoLite2-City.tar.gz.sha256'));
        yield fs.copyFile(path_1.default.join(process.cwd(), './views/GeoLite2-Country.tar.gz.sha256'), path_1.default.join(config.dbRoot, 'GeoLite2-Country.tar.gz.sha256'));
        yield fs.copyFile(path_1.default.join(process.cwd(), './views/last_update.txt'), path_1.default.join(config.dbRoot, 'last_update.txt'));
        // Get DB version
        const dbVersion = Number(yield fs.readFile(path_1.default.join(process.cwd(), './views/last_update.txt'), {
            encoding: 'utf8',
        }));
        yield fs.copyFile(path_1.default.join(process.cwd(), './views/GeoLite2-ASN.tar.gz'), `GeoLite2-ASN_${dbVersion}.tar.gz`);
        yield fs.copyFile(path_1.default.join(process.cwd(), './views/GeoLite2-City.tar.gz'), `GeoLite2-City_${dbVersion}.tar.gz`);
        yield fs.copyFile(path_1.default.join(process.cwd(), './views/GeoLite2-Country.tar.gz'), `GeoLite2-Country_${dbVersion}.tar.gz`);
        yield extractDB('asn', `GeoLite2-ASN_${dbVersion}.tar.gz`, yield readSha('asn', updater), updater);
        yield extractDB('city', `GeoLite2-City_${dbVersion}.tar.gz`, yield readSha('city', updater), updater);
        yield extractDB('country', `GeoLite2-Country_${dbVersion}.tar.gz`, yield readSha('country', updater), updater);
        logger.debug('DB setup complete');
        return dbVersion;
    });
}
class Updater {
    constructor(config) {
        this.config = config;
        this.logger = (0, logger_1.default)(config, 'Main', 'Updater');
        this.dbVersion = 0;
    }
    setup() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.config.licenseKey) {
                this.logger.warning('MaxMind License Key not found, will not update the latest IP DB');
            }
            this.dbVersion = yield setupDB(this);
            yield this.update();
        });
    }
    update() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.dbVersion = (yield updateAll(this)) || this.dbVersion;
            }
            catch (error) {
                this.logger.error(`Failed to update DB, the DB will be served with the previous version ${this.dbVersion}`);
                console.log(error);
            }
        });
    }
}
exports.default = Updater;
