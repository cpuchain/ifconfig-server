const sleep = s => new Promise(r => setTimeout(r, s * 1000));

const formatTime = () => {
  const time = new Date();
  const month = time.getMonth() + 1;
  const day = time.getDate();
  const year = time.getFullYear();
  const rawHours = time.getHours();
  const hours = (rawHours > 12) ? rawHours - 12 : rawHours;
  const minutes = time.getMinutes();
  const seconds = time.getSeconds();
  const abbreviations = (rawHours > 12) ? 'PM' : 'AM';
  // eslint-disable-next-line no-useless-escape
  const timezone = time.toString().match(/([A-Z]+[\+-][0-9]+)/)[1];
  return `${month}/${day}/${year} ${hours}:${minutes}:${seconds} ${abbreviations} ${timezone}`;
};

module.exports = {
  sleep,
  formatTime
};