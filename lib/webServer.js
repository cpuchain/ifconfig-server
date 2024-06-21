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
exports.CLI_USERAGENT = void 0;
const process_1 = __importDefault(require("process"));
const path_1 = __importDefault(require("path"));
const net_1 = __importDefault(require("net"));
const fastify_1 = require("fastify");
const cors_1 = require("@fastify/cors");
const static_1 = require("@fastify/static");
const view_1 = require("@fastify/view");
const ejs_1 = __importDefault(require("ejs"));
const config_1 = require("./config");
const logger_1 = __importDefault(require("./logger"));
const reader_1 = __importDefault(require("./reader"));
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
// Fetched from https://github.com/mpolden/echoip/blob/master/http/http.go#L382
exports.CLI_USERAGENT = [
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
function parseUserAgent(userAgent) {
    const result = {};
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
function resultToString(ipResult) {
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
function listenServer(server) {
    const { logger, config, app, reader } = server;
    let statsPromise = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    process_1.default.on('message', (msg) => {
        switch (msg.type) {
            case 'getStats':
                if (statsPromise) {
                    // Deep clone object
                    const msgJson = JSON.parse(JSON.stringify(msg));
                    delete msgJson.type;
                    statsPromise.resolve(msgJson);
                    statsPromise = null;
                }
                break;
            default:
                if (statsPromise) {
                    statsPromise.reject(new Error('Did not received a reply'));
                    statsPromise = null;
                }
                break;
        }
    });
    function getStats() {
        return new Promise((resolve, reject) => {
            if (!process_1.default.send) {
                reject(new Error('Not cluster'));
                return;
            }
            process_1.default.send({ type: 'getStats' });
            statsPromise = {
                resolve,
                reject,
            };
        });
    }
    function addVisitor(ip) {
        if (process_1.default.send) {
            process_1.default.send({ type: 'addVisitor', ip });
        }
    }
    function ipJson(req, reply) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const requestIP = ((_a = req.query) === null || _a === void 0 ? void 0 : _a.ip) || req.ip;
                const ipResult = yield reader.read(requestIP);
                // Format output as more readable
                reply
                    .header('Content-Type', 'application/json; charset=utf-8')
                    .send(JSON.stringify(ipResult, null, 2));
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            }
            catch (error) {
                reply.status(500).send({ error: error.stack || error.message });
            }
        });
    }
    function ipJsonPost(req, reply) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Body validated by ajv
                // Handle object requests
                if (!Array.isArray(req.body)) {
                    const requestIP = req.body.ip;
                    const ipResult = yield reader.read(requestIP);
                    // Format output as more readable
                    reply
                        .header('Content-Type', 'application/json; charset=utf-8')
                        .send(JSON.stringify(ipResult, null, 2));
                    return;
                }
                // Handle array requests
                const ipBody = req.body.map((body) => {
                    if (typeof body === 'string') {
                        return body;
                    }
                    else if (typeof body === 'object' && body.ip) {
                        return body.ip;
                    }
                    throw new Error('Not supported type');
                });
                const ipResult = yield Promise.all(ipBody.map((ip) => reader.read(ip)));
                reply.send(ipResult);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            }
            catch (error) {
                reply.status(500).send({ error: error.stack || error.message });
            }
        });
    }
    function ipKey(req, reply, key) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                const requestIP = ((_a = req.query) === null || _a === void 0 ? void 0 : _a.ip) || req.ip;
                const ipResult = (yield reader.read(requestIP));
                reply.send((_b = ipResult[key]) !== null && _b !== void 0 ? _b : 'unknown');
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            }
            catch (error) {
                reply.status(500).send({ error: error.stack || error.message });
            }
        });
    }
    function ipString(req, reply) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const requestIP = ((_a = req.query) === null || _a === void 0 ? void 0 : _a.ip) || req.ip;
                const ipResult = yield reader.read(requestIP);
                reply.send(resultToString(ipResult));
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            }
            catch (error) {
                reply.status(500).send({ error: error.stack || error.message });
            }
        });
    }
    function ipView(req, reply) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            try {
                const queryStringIP = (_a = req.query) === null || _a === void 0 ? void 0 : _a.ip;
                const requestIP = queryStringIP || req.ip;
                const [ipResult, stats] = yield Promise.all([
                    reader.read(requestIP),
                    getStats(),
                ]);
                // Return only IP address for some user agent like curl
                const userAgent = parseUserAgent(((_b = req.headers) === null || _b === void 0 ? void 0 : _b['user-agent']) || '').product;
                if (exports.CLI_USERAGENT.includes(userAgent || '')) {
                    reply.send(resultToString(ipResult));
                    return;
                }
                // If header includes Accept: application/json return json object
                if ((_d = (_c = req.headers) === null || _c === void 0 ? void 0 : _c.accept) === null || _d === void 0 ? void 0 : _d.includes('application/json')) {
                    reply.send(ipResult);
                    return;
                }
                reply.view('./index.html', {
                    name: config.name,
                    description: config.description,
                    keywords: config.keywords,
                    googleVerification: config.googleVerification || null,
                    defaultName: config_1.pkgJson.name,
                    version: config_1.pkgJson.version,
                    homepage: config_1.pkgJson.homepage,
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
            }
            catch (error) {
                reply.status(500).send({ error: error.stack || error.message });
            }
        });
    }
    function statsJson(reply) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                reply.send(yield getStats());
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            }
            catch (error) {
                reply.status(500).send({ error: error.stack || error.message });
            }
        });
    }
    // Define CORS for requests from browser
    app.register(cors_1.fastifyCors, () => (req, callback) => {
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
    app.register(static_1.fastifyStatic, {
        root: path_1.default.join(process_1.default.cwd(), './views'),
    });
    // Render frontend using ejs
    app.register(view_1.fastifyView, {
        engine: {
            ejs: ejs_1.default,
        },
        root: path_1.default.join(process_1.default.cwd(), './views'),
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
            process_1.default.exit(1);
        }
        logger.debug('Router', `Server listening on ${address}`);
    });
}
/**
 * Read-only web server implementation
 */
class WebServer {
    constructor(config, forkId = 0) {
        this.config = config;
        this.logSystem = 'Website';
        this.logComponent = `Thread ${forkId}`;
        this.logger = (0, logger_1.default)(config, this.logSystem, this.logComponent);
        const app = (0, fastify_1.fastify)({
            // Defining ajv keyword here
            ajv: {
                customOptions: {
                    keywords: [
                        {
                            keyword: 'isIP',
                            validate: (schema, data) => {
                                try {
                                    return Boolean(net_1.default.isIP(data));
                                }
                                catch (_a) {
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
        const reader = new reader_1.default(this.config, this.logger);
        this.app = app;
        this.reader = reader;
        listenServer(this);
    }
}
exports.default = WebServer;
