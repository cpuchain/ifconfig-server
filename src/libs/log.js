const fetch = require('./fetch');
const { formatTime } = require('./index');
const fs = require('fs');
const path = require('path');

const consoleLog = (logContext) => {
  const logPath = globalThis.config.logFile;
  const logString = `${formatTime()} ${logContext}`;

  if (!logPath) {
    console.log(logString);
    return;
  }

  try {
    fs.appendFileSync(logPath, '\n' + logString);
  } catch (e) {
    console.log(`${formatTime()} Error while writing to log file\n${(e instanceof Error ? e.message : e)}`);
  }
};

const consoleError = (errorMessage, errorContext) => {
  const logPath = globalThis.config.logFile;
  let errString = `${formatTime()} Error: ${errorMessage}`;

  if (errorContext) {
    errString += `\nError message: ${(
      errorContext instanceof Error && (errorContext.stack || errorContext.name)
        ? (errorContext.stack ?? errorContext.name) : errorContext
    )}`;
  }

  if (!globalThis.config.isSlave) {
    if (globalThis.stats && typeof globalThis.stats?.errorCount === 'number') {
      globalThis.stats.errorCount++;
    }
  } else {
    fetch(`http://127.0.0.1:${globalThis.STATS_PORT}/error`);
  }

  if (!logPath) {
    console.log(errString);
    return;
  }

  try {
    fs.appendFileSync(logPath, '\n' + errString);
  } catch (e) {
    console.log(`${formatTime()} Error while writing to log file\n${(e instanceof Error ? e.message : e)}`);
  }
};

const clearLog = () => {
  const logPath = globalThis.config.logFile;
  if (!logPath || !fs.existsSync(logPath)) {
    return;
  }

  fs.truncate(logPath, (err) => {
    if (err) {
      console.log(`${formatTime()} Error while truncate the log file\n${(err instanceof Error ? err.message : err)}`);
    }
    consoleLog('Truncated log file');
  });
};

const rotateLog = () => {
  const logPath = globalThis.config.logFile;
  if (!logPath || !fs.existsSync(logPath)) {
    return;
  }

  const parseLogPath = path.parse(logPath);
  const rotateName = path.join(parseLogPath.dir, `${parseLogPath.name}_${parseInt(new Date().getTime() / 1000)}${parseLogPath.ext}`);

  fs.copyFile(logPath, rotateName, (err) => {
    if (err) {
      consoleError(`Error while rotating log file ${logPath}`, err);
    }
    clearLog();
  });
};

module.exports = {
  consoleLog,
  consoleError,
  rotateLog
};
