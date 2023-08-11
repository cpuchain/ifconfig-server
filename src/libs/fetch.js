const fetch = require('cross-fetch');
const { SocksProxyAgent } = require('socks-proxy-agent');
const { HttpProxyAgent } = require('http-proxy-agent');
const { HttpsProxyAgent } = require('https-proxy-agent');
const USER_AGENT = require('./userAgent');

const getProxyAgent = (url, retry = 0) => {
  const config = globalThis.config;

  const isHttps = url.includes('https://');

  if (!config?.proxy && !config?.torPort) {
    return;
  }

  if (config?.torPort) {
    return new SocksProxyAgent(`socks5h://tor${retry}@127.0.0.1:${config.torPort}`);
  }

  if (config?.proxy.includes('socks') || config?.proxy.includes('socks4') || config?.proxy.includes('socks5')) {
    return new SocksProxyAgent(config.proxy);
  }

  if (config?.proxy.includes('http') || config?.proxy.includes('https')) {
    if (isHttps) {
      return new HttpsProxyAgent(config.proxy);
    }
    return new HttpProxyAgent(config.proxy);
  }
}; 

const fetchFunc = async (url, fetchOptions = {}) => {
  const config = globalThis.config;

  const MAX_RETRY = config?.MAX_RETRY ?? (config?.proxy || config?.torPort) ? 5 : 0;

  let retry = 0;
  let errorObject;

  if (!fetchOptions.method) {
    fetchOptions.method = 'GET';
  }

  if (!fetchOptions.headers) {
    fetchOptions.headers = {};
  }

  if (!fetchOptions.headers['User-Agent']) {
    fetchOptions.headers['User-Agent'] = USER_AGENT;
  }

  while (retry < MAX_RETRY + 1) {
    const controller = new AbortController();
    let timeout;
        
    fetchOptions.signal = controller.signal;

    // Config timeout in seconds
    if (config?.timeout) {
      timeout = setTimeout(() => {
        controller.abort();
      }, config.timeout * 1000);
    }

    if (config?.proxy || config?.torPort) {
      fetchOptions.agent = getProxyAgent(url, retry);
    }

    try {
      const resp = await fetch(url, fetchOptions);
            
      if (!resp.ok) {
        const errMsg = `Request to ${url} failed with error code ${resp.status}:\n`
                  + await resp.text();
        throw new Error(errMsg);
      }

      const contentType = resp.headers.get('content-type');

      // If server returns JSON object, parse it and return as an object
      if (contentType?.includes('application/json')) {
        return await resp.json();
      }

      // Else if the server returns text parse it as a string
      if (contentType?.includes('text')) {
        return await resp.text();
      }

      // Return as a response object https://developer.mozilla.org/en-US/docs/Web/API/Response
      return resp;
    } catch (error) {
      if (timeout) {
        clearTimeout(timeout);
      }

      errorObject = error;

      retry++;
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }

  throw errorObject;
};

module.exports = fetchFunc;