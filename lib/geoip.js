var fs = require('fs');
var net = require('net');
var path = require('path');

fs.existsSync = fs.existsSync || path.existsSync;

var utils = require('./utils');
var fsWatcher = require('./fsWatcher');
var async = require('async');

var dataFiles;
var watcherName = 'dataWatcher';


var privateRange4 = [
	[utils.aton4('10.0.0.0'), utils.aton4('10.255.255.255')],
	[utils.aton4('172.16.0.0'), utils.aton4('172.31.255.255')],
	[utils.aton4('192.168.0.0'), utils.aton4('192.168.255.255')]
];

var cache4 = {
	firstIP: null,
	lastIP: null,
	lastLine: 0,
	locationBuffer: null,
	locationRecordSize: 32,
	mainBuffer: null,
	recordSize: 12
};

var RECORD_SIZE = 10;
var RECORD_SIZE6 = 34;

function lookup4(ip) {
	var fline = 0;
	var floor = cache4.lastIP;
	var cline = cache4.lastLine;
	var ceil = cache4.firstIP;
	var line;
	var locId;

	var buffer = cache4.mainBuffer;
	var locBuffer = cache4.locationBuffer;
	var privateRange = privateRange4;
	var recordSize = cache4.recordSize;
	var locRecordSize = cache4.locationRecordSize;

	var i;

	var region = '';

	// outside IPv4 range
	if (ip > cache4.lastIP || ip < cache4.firstIP) {
		return null;
	}

	// private IP
	for (i = 0; i < privateRange.length; i++) {
		if (ip >= privateRange[i][0] && ip <= privateRange[i][1]) {
			return null;
		}
	}

	do {
		line = Math.round((cline - fline) / 2) + fline;
		floor = buffer.readUInt32BE(line * recordSize);
		ceil  = buffer.readUInt32BE((line * recordSize) + 4);

		if (floor <= ip && ceil >= ip) {
			if (recordSize !== RECORD_SIZE) {
				locId = buffer.readUInt32BE((line * recordSize) + 8) - 1;

				region = locBuffer.toString('utf8', (locId * locRecordSize) + 2, (locId * locRecordSize) + 4).replace(/\u0000.*/, '');
			}

			return region;
		} else if (fline === cline) {
			return null;
		} else if (fline === (cline - 1)) {
			if (line === fline) {
				fline = cline;
			} else {
				cline = fline;
			}
		} else if (floor > ip) {
			cline = line;
		} else if (ceil < ip) {
			fline = line;
		}
	} while(1);
}

function preload(dataFiles, callback) {
	var datFile;
	var datSize;
	var asyncCache = {
		firstIP: null,
		lastIP: null,
		lastLine: 0,
		locationBuffer: null,
		locationRecordSize: 32,
		mainBuffer: null,
		recordSize: 12
	};

	//when the preload function receives a callback, do the task asynchronously
	if (typeof arguments[0] === 'function') {
		async.series([
			function (cb) {
				async.series([
					function (cb2) {
						fs.open(dataFiles.cityNames, 'r', function (err, file) {
							datFile = file;
							cb2(err);
						});
					},
					function (cb2) {
						fs.fstat(datFile, function (err, stats) {
							datSize = stats.size;
							asyncCache.locationBuffer = new Buffer(datSize);
							cb2(err);
						});
					},
					function (cb2) {
						fs.read(datFile, asyncCache.locationBuffer, 0, datSize, 0, cb2);
					},
					function (cb2) {
						fs.close(datFile, cb2);
					},
					function (cb2) {
						fs.open(dataFiles.city, 'r', function (err, file) {
							datFile = file;
							cb2(err);
						});
					},
					function (cb2) {
						fs.fstat(datFile, function (err, stats) {
							datSize = stats.size;
							cb2(err);
						});
					}
				], function (err) {
					if (err) {
						if (err.code !== 'ENOENT' && err.code !== 'EBADF') {
							throw err;
						}

						fs.open(dataFiles.country, 'r', function (err, file) {
							if (err) {
								cb(err);
							} else {
								datFile = file;
								fs.fstat(datFile, function (err, stats) {
									datSize = stats.size;
									asyncCache.recordSize = RECORD_SIZE;

									cb();
								});
							}
						});
						
					} else {
						cb();
					}
				});
			},
			function () {
				asyncCache.mainBuffer = new Buffer(datSize);
				
				async.series([
					function (cb2) {
						fs.read(datFile, asyncCache.mainBuffer, 0, datSize, 0, cb2);
					},
					function (cb2) {
						fs.close(datFile, cb2);
					}
				], function (err) {
					if (err) {
						//keep old cache
					} else {
						asyncCache.lastLine = (datSize / asyncCache.recordSize) - 1;
						asyncCache.lastIP = asyncCache.mainBuffer.readUInt32BE((asyncCache.lastLine * asyncCache.recordSize) + 4);
						cache4 = asyncCache;
					}
					callback(err);
				});
			}
		]);
	} else {
		try {
			datFile = fs.openSync(dataFiles.cityNames, 'r');
			datSize = fs.fstatSync(datFile).size;

			cache4.locationBuffer = new Buffer(datSize);
			fs.readSync(datFile, cache4.locationBuffer, 0, datSize, 0);
			fs.closeSync(datFile);

			datFile = fs.openSync(dataFiles.city, 'r');
			datSize = fs.fstatSync(datFile).size;
		} catch(err) {
			if (err.code !== 'ENOENT' && err.code !== 'EBADF') {
				throw err;
			}

			datFile = fs.openSync(dataFiles.country, 'r');
			datSize = fs.fstatSync(datFile).size;
			cache4.recordSize = RECORD_SIZE;
		}

		cache4.mainBuffer = new Buffer(datSize);
		fs.readSync(datFile, cache4.mainBuffer, 0, datSize, 0);

		fs.closeSync(datFile);

		cache4.lastLine = (datSize / cache4.recordSize) - 1;
		cache4.lastIP = cache4.mainBuffer.readUInt32BE((cache4.lastLine * cache4.recordSize) + 4);
		cache4.firstIP = cache4.mainBuffer.readUInt32BE(0);
	}
}


module.exports = {
	init: function(geodatadir) {
		if (! geodatadir) {
			geodatadir = path.join(__dirname, '/../data/');
		}
		dataFiles = {
			city: path.join(geodatadir, 'geoip-city.dat'),
			cityNames: path.join(geodatadir, 'geoip-city-names.dat')
		};
		preload(dataFiles);
	},

	cmp: utils.cmp,

	lookup: function(ip) {
		if (!ip) {
			return null;
		} else if (typeof ip === 'number') {
			return lookup4(ip);
		} else if (net.isIP(ip) === 4) {
			return lookup4(utils.aton4(ip));
		}

		return null;
	},

	// Start watching for data updates. The watcher waits one minute for file transfer to 
	// completete before triggering the callback.
	startWatchingDataUpdate: function () {
		if (dataFiles) {
			fsWatcher.makeFsWatchFilter(watcherName, geodatadir, 60*1000, function () {
				//Reload data
				async.series([
					function (cb) {
						preload(dataFiles, cb);
					}
					]);
			});
		}
	},

	// Stop watching for data updates.
	stopWatchingDataUpdate: function () {
		fsWatcher.stopWatching(watcherName);
	}
};

//lookup4 = gen_lookup('geoip-country.dat', 4);
//lookup6 = gen_lookup('geoip-country6.dat', 16);
