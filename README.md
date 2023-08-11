# Ifconfig-server

Fast, scalable ip lookup service server implementation powered by [Fastify](https://fastify.io/) and [MaxMind GeoLite2 DB](https://dev.maxmind.com/geoip/geolite2-free-geolocation-data)

## Live Servers

- [ifconfig.la](https://ifconfig.la) (IPv4 only, no-logging, no-cloudflare, TOR friendly)

## Highlights

- Fast: Built on top of [Fastify](https://fastify.io/) and [node-maxmind](https://github.com/runk/node-maxmind) library which supports faster IP query against any available libraries
- Scalable: Supports read-only slave process support which enables horizontal scaling of the service
- Less-IO dependent: All IP queries happen in-memory which doesn't require storage IO (Local backups are only stored and loaded to memory on startup)
- Cross-platform: Runs on any machine where node.js is supported.

## Requirements

- For auto updates

MaxMind API key ([Get one from here](https://dev.maxmind.com/geoip/geolite2-free-geolocation-data))

- Running from binary release

None (Binary from the [last release](https://github.com/ifconfigla/ifconfig-server/releases/latest) is the only requirement)

- Running from npx or npm install

Node.js LTS version (See the [official node.js download page](https://nodejs.org/en/download))

## Quickstart

### Installation

- Running via Binary Release

```bash
  $ ifconfig-server
  # For windows
  $ ifconfig-server.exe
```

- Running via npx (Without source code)

```bash
  $ npx ifconfig-server
```

- Running via npm global install

```bash
  $ npm i -g ifconfig-server
  $ ifconfig-server
```

- Running via source code

```bash
  $ git clone https://github.com/ifconfigla/ifconfig-server
  $ cd ifconfig-server
  $ npm i
  $ ./src/start.js
```

### Running

- Running without Maxmind API key (Auto-update for MaxMind DB is off)

```bash
  $ ifconfig-server
```

- Running with Maxmind API key (Will auto-update MaxMind db every day)

```bash
  $ ifconfig-server -k "MAXMIND_KEY_HERE"
```

- Running both master and slave processes (For scaling)

```bash
  # This process will update and write DB
  $ ifconfig-server -k "MAXMIND_KEY_HERE"
  # This process will only read-only
  $ ifconfig-server -s
```

If you would like to change the default directory ($HOME/.ifconfig) where ifconfig-server stores updated DB,

Use the `-d, --root-dir` option

```bash
  $ ifconfig-server -d "customDir"
```

Check out `-h, --help` option for more command-line options

### Configuration

You can either use command-line options (Checkout `-h, --help` for available options) or use `config.json` file with `-c, --config-file` option provided.

See `config.example.json` for available configuration values.

## Cloudflare-Free

This server isn't resource intensive thus it could handle more than a thousand requests concurrently.

Therefore, it is advised not to host the website behind the cloudflare firewall unless required since it will block browser requests, command line requests, and especially tor users.

We recommend you set up an ifconfig-server behind the nginx proxy with basic configuration to prevent DOS abuse. [See here about NGINX rate limiting](https://www.nginx.com/blog/rate-limiting-nginx/#Configuring-Basic-Rate-Limiting).

If you still need to host this site under cloudflare, use `--cloudflare` option to remove Cloudflare-free notice under the website.

## Contact

dev@ifconfig.la (Receive-only email)

If you have issues, please use the Github issues rather than sending emails.

## License

By using this source code you must follow [MaxMind's GeoLite2 End User License Agreement](https://www.maxmind.com/en/geolite2/eula).

The source code of Ifconfig-server implementation is distributed with [MIT LICENSE](./LICENSE).

MaxMind GeoLite2 DB is distributed with [Creative Commons License 4.0](https://creativecommons.org/licenses/by-sa/4.0/) as a part of the source code & release binary.

We do not distribute the latest version of MaxMind GeoLite2 DB and the GeoLite2 DB bundled with the source code is distributed as a part of the source code assuming you are the legit user of [GeoLite2 End User License Agreement](https://www.maxmind.com/en/geolite2/eula).

To run with the latest, accurate IP information you will need a MaxMind API key from their homepage. [See more info about the registeration](https://dev.maxmind.com/geoip/geolite2-free-geolocation-data).

## Donations

- BTC:

```
15BrvbeHtNp5PuoUBdo95j7G2wWmpmq7Dg
```

- LTC:

```
LgK6hSbeyhE8UpsWM86z4rrCoKf38SWYH8
```

- DOGE:

```
DKjBYVArMGKXAJae1y3V9nvjZX9TVehSRL
```

- ETH:

```
0x34E3B113EBb270F2acbF312815c538EC1E12aec1
```

- XMR:

```
47qyY7CYdsDWsfpLoSUZP2Q5Hnnf3LteM9w2ZJ878XHAjAsd3ZHB6AUNb2BErfgsYA4Ne2SPLM5AzboABx4n9USJAYU5ZNZ
```

