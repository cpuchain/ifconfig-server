import process from 'process';
import net from 'net';
import { webcrypto as crypto } from 'crypto';
import { fastify, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { fastifyCors } from '@fastify/cors';
import { fastifyStatic } from '@fastify/static';
import { fastifyView } from '@fastify/view';
import ejs from 'ejs';

import { Logger } from 'logger-chain';
import { pkgJson } from './pkgJson.js';
import { type Config, viewsDir } from './config.js';
import Reader, { IPResult } from './reader.js';
import type { SeralizedStats } from './stats.js';

const gitHomepage = (() => {
    const url = new URL(pkgJson.repository.url);

    return `https://${url.host}${url.pathname.replace('.git', '')}`;
})();

const ipQueryString = {
    querystring: {
        type: 'object',
        properties: {
            ip: {
                type: 'string',
                isIP: true,
            },
        },
    },
};

/**
 * ["9.9.9.9"] or [{"ip": "9.9.9.9"}] or {"ip": "9.9.9.9"}
 */
const ipQueryPost = {
    body: {
        oneOf: [
            {
                type: 'array',
                minItems: 1,
                maxItems: 1000,
                items: {
                    type: 'string',
                    isIP: true,
                },
            },
            {
                type: 'array',
                minItems: 1,
                maxItems: 1000,
                items: {
                    type: 'object',
                    properties: {
                        ip: {
                            type: 'string',
                            isIP: true,
                        },
                    },
                    required: ['ip'],
                },
            },
            {
                type: 'object',
                properties: {
                    ip: {
                        type: 'string',
                        isIP: true,
                    },
                },
                required: ['ip'],
            },
        ],
    },
};

interface QueryString {
    ip?: string;
}

// Fetched from https://github.com/mpolden/echoip/blob/master/http/http.go#L382
export const CLI_USERAGENT = [
    'curl',
    'HTTPie',
    'httpie-go',
    'Wget',
    'fetch libfetch',
    'Go',
    'Go-http-client',
    'ddclient',
    'Mikrotik',
    'xh',
];

export interface UserAgent {
    product?: string;
    version?: string;
    comment?: string;
    raw_value: string;
}

export type IPExtended = IPResult & {
    user_agent?: UserAgent;
};

function parseUserAgent(userAgent: string) {
    const result = {} as UserAgent;
    const productVer = userAgent.split(' ')[0];
    if (productVer.split('/')[0]) {
        result.product = productVer.split('/')[0];
    }
    if (productVer.split('/')[1]) {
        result.version = productVer.split('/')[1];
    }
    if (userAgent.split(' ')[1]) {
        let comment = userAgent.slice(productVer.length);
        // Remove blank
        if (comment.slice(0, 1) === ' ') {
            comment = comment.slice(1);
        }
        result.comment = comment;
    }
    result.raw_value = userAgent;
    return result;
}

function resultToString(ipResult: IPExtended) {
    let lookupStr = ipResult.ip;

    if (ipResult.country) {
        lookupStr += ` ( Country: ${ipResult.country} )`;
    }
    if (ipResult.city) {
        lookupStr += ` ( City: ${ipResult.city} )`;
    }
    if (ipResult.time_zone) {
        lookupStr += ` ( Timezone: ${ipResult.time_zone} )`;
    }
    if (ipResult.asn && ipResult.asn_org) {
        lookupStr += ` ( ASN: ${ipResult.asn} - ${ipResult.asn_org} )`;
    }
    if (ipResult.tor) {
        lookupStr += ' ( Tor Exit )';
    }
    if (ipResult.bad_asn) {
        lookupStr += ' ( Bad ASN )';
    }
    if (ipResult.user_agent) {
        lookupStr += ` ( ${ipResult.user_agent.raw_value} )`;
    }
    return lookupStr;
}

// from https://github.com/fastify/fastify-cors/blob/master/types/index.d.ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OriginCallback = (err: Error | null, origin: any) => void;

interface StatsPromise {
    uuid: string;
    resolve: (msg: SeralizedStats) => void;
    reject: (err: Error) => void;
    resolved: boolean;
}

function listenServer(server: WebServer) {
    const { logger, config, app, reader } = server;
    let { statsQueue } = server;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    process.on('message', (msg: any) => {
        const queue = statsQueue.find((q) => q.uuid === msg.uuid);

        if (!queue) {
            return;
        }

        if (msg.error) {
            queue.reject(new Error(msg.error));
        } else {
            const msgJson = JSON.parse(JSON.stringify(msg));
            delete msgJson.uuid;
            queue.resolve(msgJson as SeralizedStats);
        }

        queue.resolved = true;

        statsQueue = statsQueue.filter((q) => !q.resolved);
    });

    function getStats(): Promise<SeralizedStats> {
        return new Promise((resolve, reject) => {
            if (!process.send) {
                reject(new Error('Not cluster'));
                return;
            }

            const uuid = crypto.randomUUID();

            process.send({
                uuid,
                type: 'getStats',
            });

            statsQueue.push({
                uuid,
                resolve,
                reject,
                resolved: false,
            });
        });
    }

    function addVisitor(ip: string) {
        if (process.send) {
            process.send({ type: 'addVisitor', ip });
        }
    }

    async function ipJson(req: FastifyRequest, reply: FastifyReply) {
        try {
            const requestIP = (req.query as QueryString)?.ip || req.ip;
            const ipResult = await reader.read(requestIP);
            // Format output as more readable
            reply
                .header('Content-Type', 'application/json; charset=utf-8')
                .send(JSON.stringify(ipResult, null, 2));
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            reply.status(500).send({ error: error.stack || error.message });
        }
    }

    async function ipJsonPost(req: FastifyRequest, reply: FastifyReply) {
        try {
            // Body validated by ajv

            // Handle object requests
            if (!Array.isArray(req.body)) {
                const requestIP = (req.body as unknown as { ip: string }).ip;
                const ipResult = await reader.read(requestIP);
                // Format output as more readable
                reply
                    .header('Content-Type', 'application/json; charset=utf-8')
                    .send(JSON.stringify(ipResult, null, 2));
                return;
            }

            // Handle array requests
            const ipBody = (req.body as unknown as (string | { ip: string })[]).map((body) => {
                if (typeof body === 'string') {
                    return body;
                } else if (typeof body === 'object' && body.ip) {
                    return body.ip;
                }
                throw new Error('Not supported type');
            });
            const ipResult = await Promise.all(ipBody.map((ip) => reader.read(ip)));
            reply.send(ipResult);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            reply.status(500).send({ error: error.stack || error.message });
        }
    }

    async function ipKey(req: FastifyRequest, reply: FastifyReply, key: string) {
        try {
            const requestIP = (req.query as QueryString)?.ip || req.ip;
            const ipResult = (await reader.read(requestIP)) as unknown as Record<string, string | number>;
            reply.send(ipResult[key] ?? 'unknown');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            reply.status(500).send({ error: error.stack || error.message });
        }
    }

    async function ipString(req: FastifyRequest, reply: FastifyReply) {
        try {
            const requestIP = (req.query as QueryString)?.ip || req.ip;
            const ipResult = await reader.read(requestIP);
            reply.send(resultToString(ipResult));
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            reply.status(500).send({ error: error.stack || error.message });
        }
    }

    async function ipView(req: FastifyRequest, reply: FastifyReply) {
        try {
            const queryStringIP = (req.query as QueryString)?.ip;
            const requestIP = queryStringIP || req.ip;

            const [ipResult, stats] = await Promise.all([reader.read(requestIP), getStats()]);

            // Return only IP address for some user agent like curl
            const userAgent = parseUserAgent(req.headers?.['user-agent'] || '').product;
            if (CLI_USERAGENT.includes(userAgent || '')) {
                reply.send(resultToString(ipResult));
                return;
            }

            // If header includes Accept: application/json return json object
            if (req.headers?.accept?.includes('application/json')) {
                reply.send(ipResult);
                return;
            }

            reply.view('./index.html', {
                name: config.name,
                description: config.description,
                keywords: config.keywords,
                googleVerification: config.googleVerification || null,
                defaultName: pkgJson.name,
                version: pkgJson.version,
                homepage: gitHomepage,
                public: config.publicEndpoint,
                lookup: ipResult,
                text: resultToString(ipResult),
                json: JSON.stringify(ipResult, null, 2),
                stats: JSON.stringify(stats, null, 2),
                queryString: queryStringIP ? '?ip=' + queryStringIP : '',
                dbVersion: stats.dbVersion,
                noCloudflare: config.noCloudflare,
            });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            reply.status(500).send({ error: error.stack || error.message });
        }
    }

    async function statsJson(reply: FastifyReply) {
        try {
            reply.send(await getStats());
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            reply.status(500).send({ error: error.stack || error.message });
        }
    }

    // Define CORS for requests from browser
    app.register(fastifyCors, () => (req: FastifyRequest, callback: OriginCallback) => {
        callback(null, {
            origin: req.headers.origin || '*',
            credentials: true,
            methods: ['GET, POST, OPTIONS'],
            headers: [
                'DNT,X-CustomHeader,Keep-Alive,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type',
            ],
        });
    });

    // Serve static data files
    app.register(fastifyStatic, {
        root: viewsDir,
    });

    // Render frontend using ejs
    app.register(fastifyView, {
        engine: {
            ejs,
        },
        root: viewsDir,
    });

    app.get('/', { schema: ipQueryString }, (req, reply) => {
        addVisitor(req.ip);
        ipView(req, reply);
    });

    app.get('/json', { schema: ipQueryString }, (req, reply) => {
        addVisitor(req.ip);
        ipJson(req, reply);
    });

    app.post('/json', { schema: ipQueryPost }, (req, reply) => {
        addVisitor(req.ip);
        ipJsonPost(req, reply);
    });

    app.get('/text', { schema: ipQueryString }, (req, reply) => {
        addVisitor(req.ip);
        ipString(req, reply);
    });

    app.get('/ip', (req, reply) => {
        addVisitor(req.ip);
        reply.send(req.ip);
    });

    app.get('/country', { schema: ipQueryString }, (req, reply) => {
        addVisitor(req.ip);
        ipKey(req, reply, 'country');
    });

    app.get('/country-iso', { schema: ipQueryString }, (req, reply) => {
        addVisitor(req.ip);
        ipKey(req, reply, 'country_iso');
    });

    app.get('/city', { schema: ipQueryString }, (req, reply) => {
        addVisitor(req.ip);
        ipKey(req, reply, 'city');
    });

    app.get('/asn', { schema: ipQueryString }, (req, reply) => {
        addVisitor(req.ip);
        ipKey(req, reply, 'asn');
    });

    app.get('/asn-org', { schema: ipQueryString }, (req, reply) => {
        addVisitor(req.ip);
        ipKey(req, reply, 'asn_org');
    });

    app.get('/tor', { schema: ipQueryString }, (req, reply) => {
        addVisitor(req.ip);
        ipKey(req, reply, 'tor');
    });

    app.get('/bad_asn', { schema: ipQueryString }, (req, reply) => {
        addVisitor(req.ip);
        ipKey(req, reply, 'bad_asn');
    });

    app.get('/stats', (req, reply) => {
        addVisitor(req.ip);
        statsJson(reply);
    });

    app.listen({ port: config.port, host: config.host }, (err, address) => {
        if (err) {
            logger.error('Router', 'Error from router');
            console.log(err);
            process.exit(1);
        }
        logger.debug('Router', `Server listening on ${address}`);
    });
}

/**
 * Read-only web server implementation
 */
export default class WebServer {
    config: Config;
    logger: Logger;
    logSystem: string;
    logComponent: string;

    app: FastifyInstance;
    reader: Reader;

    statsQueue: StatsPromise[];

    constructor(config: Config, forkId = 0) {
        this.config = config;
        this.logSystem = 'Website';
        this.logComponent = `Thread ${forkId}`;
        this.logger = new Logger(config, this.logSystem, this.logComponent);

        const app = fastify({
            // Defining ajv keyword here
            ajv: {
                customOptions: {
                    keywords: [
                        {
                            keyword: 'isIP',
                            validate: (schema: string, data: string) => {
                                try {
                                    return Boolean(net.isIP(data));
                                } catch {
                                    return false;
                                }
                            },
                            errors: true,
                        },
                    ],
                },
            },
            trustProxy: config.reverseProxy ? 1 : false,
        });

        const reader = new Reader(this.config, this.logger);

        this.app = app;
        this.reader = reader;
        this.statsQueue = [];

        listenServer(this);
    }
}
