'use strict';
var net = require('net');
var util = require('util');
var dnode = require('dnode');
var destroy = require('destroy');
var Readable = require('stream').Readable;

var levelFromName = {
    'trace': 10,
    'debug': 20,
    'info': 30,
    'warn': 40,
    'error': 50,
    'fatal': 60
};

function getLevel(level) {
    if (!level) {
        level = 10;
    } else if (!isNaN(Number(level))) {
        level = ~~level;
        if ([10, 20, 30, 40, 50, 60].indexOf(level) < 0) {
            level = 10;
        }
    } else {
        level = levelFromName[level.toString().toLowerCase()] || 10;
    }
    return level;
}

util.inherits(SubStream, Readable);

function SubStream(opts, stream) {
    if (!(this instanceof SubStream)) return new SubStream(opts, stream);
    var that = this;
    var args = Array.prototype.slice.call(arguments);
    args[0] = opts = opts || {};
    if (opts.raw) {
        opts.objectMode = true;
    }
    opts.level = getLevel(opts.level);
    Readable.apply(that, args);
    var lastUpdatedTime = Date.now();
    that.log = function (rec) {
        lastUpdatedTime = (new Date(rec.time)).valueOf();
        if (opts.objectMode) {
            that.push(rec);
        } else {
            that.push(JSON.stringify(rec) + '\n', 'utf-8');
        }
    };

    var sopts = {
        readHistory: false,
        minLevel: opts.level,
    };
    if (opts.history || opts.time) {
        sopts.readHistory = true;
        sopts.historyStartTime = ~~opts.time ? opts.time : void 0;
    }
    var d = that.d = dnode({
        log: that.log,
        getOptions: function (cb) {
            cb(sopts);
        }
    });

    d.on('remote', onremote);
    var retryCount = 0;

    function onremote(remote) {
        retryCount = 0;
    };

    d.on('error', onerror);

    function onerror(err) {
        //console.error('bunyan-sub-stream connection error:', err);
        that.d.end();
    };

    d.on('end', reconnect);

    function reconnect() {
        destroy(that.d);
        if (++retryCount > 20) {
            console.error('can not connect to bunyan-hub for 1 minute, abort.');
            that.close();
            return;
        }
        //console.error('bunyan-sub-stream connection ended');
        //console.error('will try reconnecting in 5s');
        setTimeout(function () {
            var d = that.d = dnode({
                log: that.log,
                getOptions: function (cb) {
                    cb({
                        readHistory: true,
                        historyStartTime: lastUpdatedTime + 1,
                        minLevel: opts.level,
                    });
                }
            });
            d.on('remote', onremote);
            d.on('error', onerror);
            d.on('end', reconnect);
            d.connect(28692);
        }, 5000);
    }
    d.connect(28692);

    function dend() {
        that.d.removeListener('end', reconnect);
        that.d.end();
        destroy(that.d);
    };
    that.on('end', dend);
    return that;
}

SubStream.prototype._read = function () {
    return 0;
}

SubStream.prototype.close = function () {
    this.push(null);
}

module.exports = SubStream;
