"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pkgJson = void 0;
exports.default = configFactory;
const path_1 = __importDefault(require("path"));
const process_1 = __importDefault(require("process"));
const os_1 = __importDefault(require("os"));
const package_json_1 = __importDefault(require("../package.json"));
require("dotenv/config");
exports.pkgJson = package_json_1.default;
function configFactory() {
    const config = {
        host: process_1.default.env.HOST || '0.0.0.0',
        port: Number(process_1.default.env.PORT) || 3000,
        workers: Number(process_1.default.env.WORKERS) || os_1.default.cpus().length,
        logLevel: process_1.default.env.LOG_LEVEL || 'debug',
        logColors: process_1.default.env.LOG_COLORS !== 'false',
        licenseKey: process_1.default.env.LICENSE_KEY,
        dbRoot: process_1.default.env.DB_ROOT || path_1.default.join(process_1.default.cwd(), './data'),
        updateInterval: process_1.default.env.UPDATE_INTERVAL
            ? Number(process_1.default.env.UPDATE_INTERVAL) * 1000
            : 86400 * 1000,
        reverseProxy: process_1.default.env.REVERSE_PROXY === 'true',
        name: process_1.default.env.NAME || exports.pkgJson.name,
        description: process_1.default.env.DESCRIPTION || exports.pkgJson.description,
        keywords: process_1.default.env.KEYWORDS || exports.pkgJson.keywords.join(', '),
        publicEndpoint: process_1.default.env.PUBLIC_ENDPOINT || '',
        googleVerification: process_1.default.env.GOOGLE_VERIFICATION,
        noCloudflare: process_1.default.env.NO_CLOUDFLARE !== 'false',
    };
    // if this is blank
    if (!config.publicEndpoint) {
        config.publicEndpoint = `http://${config.host}:${config.port}`;
    }
    return config;
}
