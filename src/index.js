const fs = require('fs');
const path = require('path');
const process = require('process');
const net = require('net');

const { fastify } = require('fastify');
const { fastifyCors } = require('@fastify/cors');
const { fastifyStatic } = require('@fastify/static');
const { fastifyView } = require('@fastify/view');
const qs = require('qs');
const ejs = require('ejs');
const { getDBRoot, initDB, checkDB, memDB } = require('./services/filesystem');
const { lookupIP } = require('./services/maxmind');
const { checkTor } = require('./services/torlist');
const { checkAsn } = require('./services/asnlist');
const updater = require('./services/update');
const { addVisitor, clearVisitors } = require('./services/visitor');
const { formatTime } = require('./libs');
const { consoleLog, consoleError, rotateLog } = require('./libs/log');
const { name: defaultName, version, homepage, description: defaultDescription, keywords: defaultKeywords } = require('../package.json');

/**
 * Global objects here
 */
// Use importStats func to import from stats file
// NOTICE: only the stats object of master process should be considered as correct
globalThis.stats = {
  queryCount: 0,
  visitorCount: 0,
  errorCount: 0,
  updatedDB: 0,
  dbVersion: '',
  lastUpdate: '',
  lastDBUpdate: ''
};

// Fetched from https://github.com/mpolden/echoip/blob/master/http/http.go#L382
const CLI_USERAGENT = ['curl', 'HTTPie', 'httpie-go', 'Wget', 'fetch libfetch', 'Go', 'Go-http-client', 'ddclient', 'Mikrotik', 'xh'];

// Following https://ifconfig.co/json format
const parseUserAgent = (userAgent) => {
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
};

const lookup = (req) => {
  const ip = (req.query?.ip && net.isIP(req.query?.ip)) ? req.query?.ip : req.ip;
  try {
    const userAgent = req.headers?.['user-agent'];

    const lookupRes = lookupIP(ip);
    const tor = checkTor(ip);
    const bad_asn = lookupRes.asn ? checkAsn(lookupRes.asn) : false;
    const userAgentRes = userAgent ? parseUserAgent(userAgent) : {};

    return {
      ...lookupRes,
      tor,
      bad_asn,
      user_agent: userAgentRes
    };
  } catch (e) {
    consoleError(`Failed to lookup ${ip}`, e);
  }
};

// Return object into simple text string for cli userAgents
const lookupString = (req) => {
  const lookupObj = lookup(req);

  let lookupStr = lookupObj.ip;

  if (lookupObj.country) {
    lookupStr += ` ( Country: ${lookupObj.country} )`;
  }
  if (lookupObj.city) {
    lookupStr += ` ( City: ${lookupObj.city} )`;
  }
  if (lookupObj.time_zone) {
    lookupStr += ` ( Timezone: ${lookupObj.time_zone} )`;
  }
  if (lookupObj.asn && lookupObj.asn_org) {
    lookupStr += ` ( ASN: ${lookupObj.asn} - ${lookupObj.asn_org} )`;
  }
  if (lookupObj.tor) {
    lookupStr += ' ( Tor Exit )';
  }
  if (lookupObj.bad_asn) {
    lookupStr += ' ( Bad ASN )';
  }
  if (lookupObj.user_agent) {
    lookupStr += ` ( ${lookupObj.user_agent.raw_value} )`;
  }
  return lookupStr;
};

// Return formatted JSON object (without minifying)
const replyJSON = (object, reply) => {
  return reply
    .header('Content-Type', 'application/json; charset=utf-8')
    .send(JSON.stringify(object, null, 2));
};

const updateStats = () => {
  const statsPath = path.join(getDBRoot(), './stats.json');

  globalThis.stats.lastUpdate = formatTime();
  globalThis.stats.dbVersion = globalThis.db.lastUpdate;
  fs.writeFile(statsPath, JSON.stringify(globalThis.stats, null, 2), (err) => {
    if (err) {
      consoleError('Failed to update stats file', err);
    }
  });
};

const listenStats = () => {
  // Debounce multiple file change notifications for a period of time
  // https://stackoverflow.com/questions/12978924/fs-watch-fired-twice-when-i-change-the-watched-file
  let fsTimeout;

  const statsPath = path.join(getDBRoot(), './stats.json');

  fs.watch(statsPath, () => {
    if (!fsTimeout) {
      setTimeout(() => {
        fs.readFile(statsPath, { encoding: 'utf8' }, (err, data) => {
          if (err) {
            return;
          }
          globalThis.stats = JSON.parse(data);
        });
      }, 500);
      // give 3 seconds for multiple events
      fsTimeout = setTimeout(() => { fsTimeout = null; }, 3000);
    }
  });
};

const importStats = () => {
  const statsPath = path.join(getDBRoot(), './stats.json');

  if (!fs.existsSync(statsPath)) {
    return;
  }

  try {
    const localStats = JSON.parse(fs.readFileSync(statsPath, { encoding: 'utf8' }));
    let useLocalStats = true;

    // Audit local stats file
    Object.keys(globalThis.stats).forEach(stat => {
      if (!Object.keys(localStats).includes(stat)) {
        useLocalStats = false;
        consoleLog('Missing stats keys, skipping import');
      }
    });

    if (useLocalStats) {
      globalThis.stats = localStats;
      consoleLog(`Imported Stats:\n${JSON.stringify(globalThis.stats, null, 2)}`);
    }
  } catch (e) {
    consoleError(`Failed to import stats from ${statsPath}`, e);
    return;
  }
};

const updateAll = async () => {
  await updater();
  clearVisitors();
  globalThis.stats.updatedDB++;
  globalThis.stats.lastDBUpdate = formatTime();
};

const Ifconfig = async () => {
  if (!globalThis.config) {
    globalThis.config = {};
  }
  // Define default port for ifconfig-server
  if (!globalThis.config.port) {
    globalThis.config.port = 3000;
  }
  if (!globalThis.config.statsPort) {
    globalThis.config.statsPort = globalThis.config.port + 1;
  }
  if (!globalThis.config.publicEndpoint) {
    globalThis.config.publicEndpoint = `http://${globalThis.config.host ?? 'localhost'}:${globalThis.config.port}`;
  }
  if (!globalThis.config.name) {
    globalThis.config.name = defaultName;
  }

  checkDB();
  importStats();
  // Initialize DB directory and update DB
  if (!globalThis.config.isSlave) {
    await initDB();
    await updateAll();
    setInterval(updateStats, 5 * 1000);
    // Update all DB every day
    setInterval(updateAll, globalThis.config.updateInterval ? globalThis.config.updateInterval * 1000 : 86400 * 1000);
    // Rotate log every week
    setInterval(rotateLog, globalThis.config.logRotation ? globalThis.config.logRotation * 1000 : 259200 * 1000);
  } else {
    // Sync stats with slave processes
    listenStats();
  }
  // Initialize DB to memory
  await memDB();

  const app = fastify({
    querystringParser: str => qs.parse(str),
    trustProxy: globalThis.config.reverseProxy ? 1 : false
  });

  // Define CORS for requests from browser
  app.register(fastifyCors, () => (req, callback) => {
    callback(null, {
      origin: req.headers.origin || '*',
      credentials: true,
      methods: ['GET, POST, OPTIONS'],
      headers: ['DNT,X-CustomHeader,Keep-Alive,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type']
    });
  });

  // Serve static data files
  app.register(fastifyStatic, {
    root: getDBRoot()
  });

  // Render frontend using ejs
  app.register(fastifyView, {
    engine: {
      ejs
    },
    root: getDBRoot()
  });

  app.get('/', (req, reply) => {
    addVisitor(req.ip);
    // Return only IP address for some user agent like curl
    const userAgent = parseUserAgent(req.headers?.['user-agent']).product;
    if (CLI_USERAGENT.includes(userAgent)) {
      return reply.send(lookupString(req) ?? 'unknown');
    }

    // If header includes Accept: application/json return json object
    if (req.headers?.accept.includes('application/json')) {
      return reply.send(lookup(req));
    }

    return reply.view('./index.html', {
      name: globalThis.config.name,
      description: globalThis.config.description || defaultDescription,
      keywords: globalThis.config.keywords || defaultKeywords.join(', '),
      defaultName,
      version,
      homepage,
      donation: globalThis.config.donation ? globalThis.config.donation : undefined,
      public: globalThis.config.publicEndpoint,
      lookup: lookup(req),
      text: lookupString(req) ?? 'unknown',
      json: JSON.stringify(lookup(req), null, 2),
      stats: JSON.stringify(globalThis.stats, null, 2),
      queryString: req.query?.ip ? '?ip=' + req.query?.ip : '',
      lastUpdate: globalThis.db.lastUpdate,
      noCloudflare: !globalThis.config.cloudflare
    });
  });

  // JSON only endpoint
  app.get('/json', (req, reply) => {
    addVisitor(req.ip);
    replyJSON(lookup(req), reply);
  });

  app.get('/text', (req, reply) => {
    addVisitor(req.ip);
    return reply.send(lookupString(req) ?? 'unknown');
  });

  app.get('/ip', (req, reply) => {
    addVisitor(req.ip);
    return reply.send(req.ip);
  });

  app.get('/country', (req, reply) => {
    addVisitor(req.ip);
    return reply.send(lookup(req).country ?? 'unknown');
  });

  app.get('/country-iso', (req, reply) => {
    addVisitor(req.ip);
    return reply.send(lookup(req).country_iso ?? 'unknown');
  });

  app.get('/city', (req, reply) => {
    addVisitor(req.ip);
    return reply.send(lookup(req).city ?? 'unknown');
  });

  app.get('/asn', (req, reply) => {
    addVisitor(req.ip);
    return reply.send(lookup(req).asn ?? 'unknown');
  });

  app.get('/asn-org', (req, reply) => {
    addVisitor(req.ip);
    return reply.send(lookup(req).asn_org ?? 'unknown');
  });

  app.get('/tor', (req, reply) => {
    addVisitor(req.ip);
    return reply.send(lookup(req).tor ?? 'unknown');
  });

  app.get('/bad_asn', (req, reply) => {
    addVisitor(req.ip);
    return reply.send(lookup(req).bad_asn ?? 'unknown');
  });

  if (!globalThis.config.isSlave) {
    const statsApp = fastify({
      querystringParser: str => qs.parse(str),
    });

    statsApp.get('/addVisitor', (req, reply) => {
      addVisitor(req.query?.ip);
      return reply.send('true');
    });

    statsApp.get('/error', (req, reply) => {
      globalThis.stats.errorCount++;
      return reply.send('true');
    });

    statsApp.get('/', (req, reply) => {
      replyJSON(globalThis.stats, reply);
    });

    // Listen fastify on port
    statsApp.listen({ port: globalThis.config.statsPort, host: globalThis.config.host ?? '127.0.0.1' }, (err, address) => {
      if (err) {
        consoleError('Error from stats server', err);
        process.exit(1);
      }
      consoleLog(`Stats Listening on ${address}`);
    });
  }

  app.get('/stats', (req, reply) => {
    replyJSON(globalThis.stats, reply);
  });

  // Listen fastify on port
  app.listen({ port: globalThis.config.port, host: globalThis.config.host ?? '127.0.0.1' }, (err, address) => {
    if (err) {
      consoleError(`Error from ${address} server`, err);
      process.exit(1);
    }
    consoleLog(`Listening on ${address}`);
  });
};

module.exports = Ifconfig;
