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
exports.readIP = readIP;
const fs = __importStar(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const mmdb_lib_1 = require("mmdb-lib");
// EU country iso codes
// https://www.yourdictionary.com/articles/europe-country-codes
// prettier-ignore
const EU = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];
function buildResult(CountryDB, CityDB, ASNDB, TorDB, BadAsnDB, ip) {
    const countryResult = CountryDB.get(ip);
    const cityResult = CityDB.get(ip);
    const asnResult = ASNDB.get(ip);
    const result = {
        ip,
    };
    if (countryResult === null || countryResult === void 0 ? void 0 : countryResult.country) {
        result.country = countryResult.country.names.en;
        result.country_iso = countryResult.country.iso_code;
        result.country_eu = EU.includes(countryResult.country.iso_code);
    }
    if (countryResult === null || countryResult === void 0 ? void 0 : countryResult.registered_country) {
        result.country_registered = countryResult.registered_country.names.en;
    }
    if (cityResult === null || cityResult === void 0 ? void 0 : cityResult.city) {
        result.city = cityResult.city.names.en;
    }
    if (cityResult === null || cityResult === void 0 ? void 0 : cityResult.location) {
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
        result.asn = 'AS' + asnResult.autonomous_system_number;
        result.asn_org = asnResult.autonomous_system_organization;
    }
    result.tor = TorDB.has(ip);
    result.bad_asn = result.asn ? BadAsnDB.has(result.asn) : undefined;
    return result;
}
function readIP(dbRoot, ips) {
    return __awaiter(this, void 0, void 0, function* () {
        const files = yield Promise.all([
            fs.readFile(path_1.default.join(dbRoot, 'GeoLite2-Country.mmdb')),
            fs.readFile(path_1.default.join(dbRoot, 'GeoLite2-City.mmdb')),
            fs.readFile(path_1.default.join(dbRoot, 'GeoLite2-ASN.mmdb')),
            fs.readFile(path_1.default.join(dbRoot, 'torlist.json'), { encoding: 'utf8' }),
            fs.readFile(path_1.default.join(dbRoot, 'asnlist.json'), { encoding: 'utf8' }),
        ]);
        const CountryDB = new mmdb_lib_1.Reader(files[0]);
        const CityDB = new mmdb_lib_1.Reader(files[1]);
        const ASNDB = new mmdb_lib_1.Reader(files[2]);
        const TorDB = new Set(JSON.parse(files[3]));
        const BadAsnDB = new Set(JSON.parse(files[4]));
        return ips.map((ip) => buildResult(CountryDB, CityDB, ASNDB, TorDB, BadAsnDB, ip));
    });
}
class Reader {
    constructor(config, logger) {
        this.config = config;
        this.logger = logger;
        this.queue = [];
        this.drainTimer = null;
    }
    queueWorker() {
        return __awaiter(this, void 0, void 0, function* () {
            const queueIPs = [...new Set(this.queue.map(({ ip }) => ip))];
            try {
                const result = yield readIP(this.config.dbRoot, queueIPs);
                this.queue = this.queue.filter(({ ip, resolve }) => {
                    const index = queueIPs.indexOf(ip);
                    if (index > -1) {
                        resolve(result[index]);
                        // Drop from queue
                        return false;
                    }
                    return true;
                });
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            }
            catch (err) {
                this.queue = this.queue.filter(({ ip, reject }) => {
                    if (queueIPs.indexOf(ip) > -1) {
                        reject(err);
                        // Drop from queue
                        return false;
                    }
                    return true;
                });
            }
            if (this.queue.length) {
                this.logger.debug(`Queue ${this.queue.length} not cleared, consuming again`);
                this.queueWorker();
            }
            else {
                // Accept more workloads
                this.drainTimer = null;
            }
        });
    }
    read(ip) {
        return new Promise((resolve, reject) => {
            this.queue.push({
                ip,
                resolve,
                reject,
            });
            if (!this.drainTimer) {
                this.drainTimer = setTimeout(() => this.queueWorker(), 50);
            }
        });
    }
}
exports.default = Reader;
