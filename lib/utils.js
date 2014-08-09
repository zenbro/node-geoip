var utils = module.exports = {};

utils.aton4 = function(a) {
  a = a.split(/\./);
  return ((parseInt(a[0], 10)<<24)>>>0) + ((parseInt(a[1], 10)<<16)>>>0) + ((parseInt(a[2], 10)<<8)>>>0) + (parseInt(a[3], 10)>>>0);
};

utils.cmp = function(a, b) {
  if (typeof a === 'number' && typeof b === 'number') {
    return (a < b ? -1 : (a > b ? 1 : 0));
  }

  if (a instanceof Array && b instanceof Array) {
    return this.cmp6(a, b);
  }

  return null;
};

utils.isPrivateIP = function(addr) {
  addr = addr.toString();

  return addr.match(/^10\.([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})/) != null ||
    addr.match(/^192\.168\.([0-9]{1,3})\.([0-9]{1,3})/) != null ||
    addr.match(/^172\.16\.([0-9]{1,3})\.([0-9]{1,3})/) != null ||
    addr.match(/^127\.([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})/) != null ||
    addr.match(/^169\.254\.([0-9]{1,3})\.([0-9]{1,3})/) != null ||
    addr.match(/^fc00:/) != null || addr.match(/^fe80:/) != null;
};

utils.ntoa4 = function(n) {
  n = n.toString();
  n = '' + (n>>>24&0xff) + '.' + (n>>>16&0xff) + '.' + (n>>>8&0xff) + '.' + (n&0xff);

  return n;
};
