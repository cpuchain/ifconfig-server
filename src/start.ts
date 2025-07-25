import process from 'process';
import cluster from 'cluster';
import { Logger } from 'logger-chain';

import configFactory, { Config } from './config.js';
import Stats from './stats.js';
import { formatDate } from './utils.js';

import WebServer from './webServer.js';
import Updater from './updater.js';

if (cluster.isWorker) {
    const config = JSON.parse(process.env.config as string) as Config;
    const forkId = Number(process.env.forkId);

    switch (process.env.workerType) {
        case 'website':
            new WebServer(config, forkId);
            break;
    }
}

const config = configFactory();
const logger = new Logger(config);
const stats = new Stats(config);

function createServerWorker(forkId: number) {
    const worker = cluster.fork({
        workerType: 'website',
        forkId,
        config: JSON.stringify(config),
    });
    worker
        .on('exit', (code) => {
            logger.debug(
                'Main',
                'Spawner',
                `Website worker ${forkId} exit with ${code}, spawning replacement...`,
            );
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
                    worker.send({
                        uuid: msg.uuid,
                        type: 'getStats',
                        ...stats.serialize(),
                    });
                    break;
            }
        });
}

async function start() {
    const updater = new Updater(config);

    // Complete initial DB update
    await updater.setup();
    stats.updatedDB++;
    stats.dbVersion = updater.dbVersion;
    stats.lastDBUpdate = formatDate(new Date());
    stats.lastUpdate = formatDate(new Date());

    // Start workers
    let i = 0;
    while (i < config.workers) {
        createServerWorker(i);
        ++i;
    }

    logger.debug('Main', 'Spawner', `Spawned ${i} website workers`);

    setInterval(async () => {
        stats.clearVisitors();

        await updater.update();

        if (stats.dbVersion !== updater.dbVersion) {
            stats.updatedDB++;
            stats.dbVersion = updater.dbVersion;
            stats.lastDBUpdate = formatDate(new Date());
        }
        stats.lastUpdate = formatDate(new Date());
    }, config.updateInterval);
}

if (cluster.isPrimary) {
    start();
}
