const crypto = require('crypto').webcrypto;
const fetch = require('../libs/fetch');
const { consoleError } = require('../libs/log');

let visitors = [];

const digestIP = (ip) => {
  return crypto.subtle.digest('SHA-1', new TextEncoder().encode(ip))
    .then(d => {
      return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('');
    });
};

// Add hashed IP to visitor database
const addVisitor = async (ip) => {
  try {
    if (!globalThis.config.isSlave) {
      const digested = await digestIP(ip);
      
      if (!visitors.includes(digested)) {
        globalThis.stats.visitorCount++;
        visitors.push(digested);
      }
  
      globalThis.stats.queryCount++;
      return;
    }
    await fetch(`http://127.0.0.1:${globalThis.STATS_PORT}/addVisitor?ip=${ip}`);
  } catch (e) {
    consoleError('Error while counting visitor', e);
  }
};

const clearVisitors = () => {
  visitors = [];
  globalThis.stats.visitorCount = 0;
  globalThis.stats.queryCount = 0;
};

module.exports = {
  addVisitor,
  clearVisitors
};