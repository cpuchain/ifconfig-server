"use strict";
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
const process_1 = __importDefault(require("process"));
const cluster_1 = __importDefault(require("cluster"));
const dateformat_1 = __importDefault(require("dateformat"));
const config_1 = __importDefault(require("./config"));
const logger_1 = __importDefault(require("./logger"));
const stats_1 = __importDefault(require("./stats"));
const webServer_1 = __importDefault(require("./webServer"));
const updater_1 = __importDefault(require("./updater"));
const config = (0, config_1.default)();
const logger = (0, logger_1.default)(config);
const stats = new stats_1.default(config);
if (cluster_1.default.isWorker) {
    const config = JSON.parse(process_1.default.env.config);
    const forkId = Number(process_1.default.env.forkId);
    switch (process_1.default.env.workerType) {
        case 'website':
            new webServer_1.default(config, forkId);
            break;
    }
}
function createServerWorker(forkId) {
    const worker = cluster_1.default.fork({
        workerType: 'website',
        forkId,
        config: JSON.stringify(config),
    });
    worker
        .on('exit', (code) => {
        logger.debug('Main', 'Spawner', `Website worker ${forkId} exit with ${code}, spawning replacement...`);
        setTimeout(() => {
            createServerWorker(forkId);
        }, 2000);
    })
        .on('message', (msg) => {
        switch (msg.type) {
            case 'addVisitor':
                stats.addVisitor(msg.ip);
                break;
            case 'getStats':
                worker.send(Object.assign({ type: 'getStats' }, stats.serialize()));
                break;
        }
    });
}
function start() {
    return __awaiter(this, void 0, void 0, function* () {
        const updater = new updater_1.default(config);
        // Complete initial DB update
        yield updater.setup();
        stats.updatedDB++;
        stats.dbVersion = updater.dbVersion;
        stats.lastDBUpdate = (0, dateformat_1.default)(new Date(), 'yyyy-mm-dd HH:MM:ss Z');
        stats.lastUpdate = (0, dateformat_1.default)(new Date(), 'yyyy-mm-dd HH:MM:ss Z');
        // Start workers
        let i = 0;
        while (i < config.workers) {
            createServerWorker(i);
            ++i;
        }
        logger.debug('Main', 'Spawner', `Spawned ${i} website workers`);
        setInterval(() => __awaiter(this, void 0, void 0, function* () {
            stats.clearVisitors();
            yield updater.update();
            if (stats.dbVersion !== updater.dbVersion) {
                stats.updatedDB++;
                stats.dbVersion = updater.dbVersion;
                stats.lastDBUpdate = (0, dateformat_1.default)(new Date(), 'yyyy-mm-dd HH:MM:ss Z');
            }
            stats.lastUpdate = (0, dateformat_1.default)(new Date(), 'yyyy-mm-dd HH:MM:ss Z');
        }), config.updateInterval);
    });
}
if (cluster_1.default.isPrimary) {
    start();
}
