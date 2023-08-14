#!/usr/bin/env node
const { Command, InvalidArgumentError } = require('commander');
const { name, version, description } = require('../package.json');
const Ifconfig = require('./index.js');
const { formatTime } = require('./libs');
const updater = require('./services/update');
const { resetDB } = require('./services/filesystem');
const process = require('process');
const fs = require('fs');
const program = new Command();

const checkInt = (value) => {
  // parseInt takes a string and a radix
  const parsedValue = parseInt(value, 10);
  if (isNaN(parsedValue)) {
    const errMsg = `\n\nInvalid option: ${parsedValue} is not a number.`;
    throw new InvalidArgumentError(errMsg);
  }
  return parsedValue;
};

const checkString = (value, dummyPrevious, param, stringLength = 0) => {
  if (!value || typeof value !== 'string' || value.length <= stringLength) {
    const errMsg = (value.length <= stringLength && param)
      ? `\n\nInvalid ${param} length: ${value} does not have a required ${stringLength} ${param.toLowerCase()} length`
      : param
        ? `\n\nInvalid ${param} : ${value} is not a valid ${param.toLowerCase()} value`
        : `\n\nInvalid argument: ${value} is not a valid string`;
    throw new InvalidArgumentError(errMsg);
  }
  return value;
};

program
  .name(name)
  .description(`${name} ${version} (Node ${process.version})\n\n` + description)
  .version(`${name} ${version} (Node ${process.version})`)
  .option(
    '-c, --config-file <CONFIG_FILE>',
    'JSON config file to use the server',
    (arg1, arg2) => checkString(arg1, arg2, 'Config File')
  )
  .option(
    '-d, --root-dir <ROOT_DIR>',
    'Home directory to store synced Maxmind DB (Defaults to $HOME/.ifconfig)',
    (arg1, arg2) => checkString(arg1, arg2, 'Home Directory')
  )
  .option(
    '-s, --is-slave',
    'Enable running server with read-only mode (Use this option if you tend to run more than one server process for scaling)'
  )
  .option(
    '-k, --license-key <LICENSE_KEY>',
    'MaxMind API key used for auto-sync',
    (arg1, arg2) => checkString(arg1, arg2, 'License Key')
  )
  .option(
    '-p, --port <PORT>',
    'TCP port for ifconfig-server to listen on (Default to 3000)',
    checkInt,
    3000
  )
  .option(
    '-sp, --stats-port <STATS_PORT>',
    'TCP port for stats server to listen on (Only enabled by non-slave process)',
    checkInt,
    3001
  )
  .option(
    '-host, --host <HOST>',
    'Host interface for ifconfig-server and stats server to listen on (Default to 127.0.0.1)',
    (arg1, arg2) => checkString(arg1, arg2, 'Host'),
    '127.0.0.1'
  )
  .option(
    '-n, --name <NAME>',
    'Name for server to be called (Default to ifconfig-server)',
    (arg1, arg2) => checkString(arg1, arg2, 'Name'),
    'ifconfig-server'
  )
  .option(
    '-desc, --description <DESCRIPTION>',
    'Description to show on the frontend',
    (arg1, arg2) => checkString(arg1, arg2, 'Description')
  )
  .option(
    '-keywords, --keywords <KEYWORDS>',
    'Keywords to show on the frontend',
    (arg1, arg2) => checkString(arg1, arg2, 'Keywords')
  )
  .option(
    '-google, --google-verification <GOOGLE_VERIFICATION>',
    'Verification code for google search console',
    (arg1, arg2) => checkString(arg1, arg2, 'Google Verification')
  )
  .option(
    '-donate, --donation <DONATION>',
    'Add donation banner to the website',
    (arg1, arg2) => checkString(arg1, arg2, 'Name')
  )
  .option(
    '-e, --public-endpoint <PUBLIC_ENDPOINT>',
    'Public endpoint URL for server to be shown on frontend (Default to http://<host>:<port>)',
    (arg1, arg2) => checkString(arg1, arg2, 'Public Endpoint')
  )
  .option(
    '-i, --update-interval <UPDATE_INTERVAL>',
    'Check and update databases for this interval (Default to run updates every 24 hours)',
    checkInt,
    86400
  )
  .option(
    '-l, --log-file <LOG_FILE>',
    'Output console log output to this file',
    (arg1, arg2) => checkString(arg1, arg2, 'Log File')
  )
  .option(
    '-lr, --log-rotation <LOG_ROTATION>',
    'Rotate log file for this interval (Default to run every week - only works when the log file is specified)',
    checkInt,
    259200
  )
  .option(
    '-proxy, --proxy <PROXY>',
    'Use http / socks proxy for http connection (Used for remote updates)',
    (arg1, arg2) => checkString(arg1, arg2, 'Proxy')
  )
  .option(
    '-tor, --tor-port <TOR_PORT>',
    'Use local TOR port for http connection (Used for remote updates)',
    checkInt
  )
  .option(
    '-retry, --max-retry <MAX_RETRY>',
    'Count to retry failed http requests'
  )
  .option(
    '-user-agent, --user-agent <USER_AGENT>',
    'User agent to use for http requests',
    (arg1, arg2) => checkString(arg1, arg2, 'User Agent')
  )
  .option(
    '-cloudflare, --cloudflare',
    'Enable this option if you host the site behind cloudflare'
  )
  .option(
    '-r, --reverse-proxy',
    'Enable this option if you host the site behind reverse proxies like NGINX or Cloudflare',
    true
  )
  .action((options) => {
    if (options.configFile && fs.existsSync(options.configFile)) {
      try {
        const configFile = options.configFile;
        options = JSON.parse(fs.readFileSync(options.configFile, { encoding: 'utf8' }));
        options.configFile = configFile;
        console.log(`${formatTime()} Read configuration from ${options.configFile} file`);
      } catch (e) {
        console.log(`Error while trying to read config file from ${options.configFile}`);
        console.log(e);
        throw e;
      }
    }
    if (!options.isSlave) {
      options.isSlave = false;
    }
    if (!options.licenseKey && process.env.LICENSE_KEY) {
      options.licenseKey = process.env.LICENSE_KEY;
    }

    const sortedConfig = Object.keys(options)
      .sort()
      .reduce((acc, key) => {
        acc[key] = options[key];
        return acc;
      }, {});

    globalThis.config = sortedConfig;
    console.log(`${formatTime()} Starting ifconfig-server with the following config:\n${JSON.stringify(sortedConfig, null, 2)}`);
    Ifconfig();
  });

program
  .command('update')
  .description('Update MaxMind DB for the given ifconfig home directory')
  .option(
    '-c, --config-file <CONFIG_FILE>',
    'JSON config file to use the server',
    (arg1, arg2) => checkString(arg1, arg2, 'Config File')
  )
  .option(
    '-d, --root-dir <ROOT_DIR>',
    'Home directory to store synced Maxmind DB (Defaults to $HOME/.ifconfig)',
    (arg1, arg2) => checkString(arg1, arg2, 'Home Directory')
  )
  .option(
    '-k, --license-key <LICENSE_KEY>',
    'MaxMind API key used for auto-sync',
    (arg1, arg2) => checkString(arg1, arg2, 'License Key')
  )
  .action(() => {
    // Strange bug here so using options from the main one
    let options = program.opts();
    if (options.configFile && fs.existsSync(options.configFile)) {
      try {
        const configFile = options.configFile;
        options = JSON.parse(fs.readFileSync(options.configFile, { encoding: 'utf8' }));
        options.configFile = configFile;
        console.log(`${formatTime()} Read configuration from ${options.configFile} file`);
      } catch (e) {
        console.log(`Error while trying to read config file from ${options.configFile}`);
        console.log(e);
        throw e;
      }
    }
    if (!options.licenseKey && process.env.LICENSE_KEY) {
      options.licenseKey = process.env.LICENSE_KEY;
    }
    
    const sortedConfig = Object.keys(options)
      .sort()
      .reduce((acc, key) => {
        acc[key] = options[key];
        return acc;
      }, {});

    globalThis.config = sortedConfig;
    console.log(`${formatTime()} Starting ifconfig-server updater with the following config:\n${JSON.stringify(sortedConfig, null, 2)}`);
    updater();
  });

program
  .command('remove')
  .description('Remove existing ifconfig databases')
  .option(
    '-d, --root-dir <ROOT_DIR>',
    'Home directory to store synced Maxmind DB (Defaults to $HOME/.ifconfig)',
    (arg1, arg2) => checkString(arg1, arg2, 'Home Directory')
  )
  .action(() => {
    // Strange bug here so using options from the main one
    const options = program.opts();
    
    const sortedConfig = Object.keys(options)
      .sort()
      .reduce((acc, key) => {
        acc[key] = options[key];
        return acc;
      }, {});

    globalThis.config = sortedConfig;
    console.log(`${formatTime()} Starting ifconfig database remover with the following config:\n${JSON.stringify(sortedConfig, null, 2)}`);
    resetDB();
  });

program.parse();
