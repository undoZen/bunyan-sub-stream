'use strict';
var net = require('net');
var util = require('util');
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

function isValidRecord(rec) {
    if (!rec ||
        rec.v == null ||
        rec.level == null ||
        rec.name == null ||
        rec.hostname == null ||
        rec.pid == null ||
        rec.time == null ||
        rec.msg == null) {
        // Not valid Bunyan log.
        return false;
    } else {
        return true;
    }
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

    var sopts = {
        cmd: 'subscribe',
        history: false,
        level: opts.level,
    };
    if (opts.history || opts.time) {
        sopts.history = true;
        sopts.time = ~~opts.time ? opts.time : void 0;
    }
    var port = 28692;
    if (typeof opts.port === 'number') {
        port = opts.port;
    }
    var host = '127.0.0.1';
    if (typeof opts.host === 'string') {
        host = opts.host;
    }
    var socket = that.socket = net.connect(port, host);
    socket.on('connect', onconnect);
    socket.on('data', ondata);
    socket.on('error', onerror);
    //socket.on('end', onend);
    socket.on('close', reconnect);

    var retryCount = 0;
    var firstTimeConnection = true;
    var bufs = [];

    function onconnect(remote) {
        retryCount = 0;
        bufs = [];
        that.socket.write(JSON.stringify(firstTimeConnection ?
            sopts : {
                cmd: 'subscribe',
                history: true,
                time: lastUpdatedTime + 1,
                level: opts.level,
            }
        ) + '\n');
    };

    function ondata(data) {
        //console.error('bunyan-sub-stream connection error:', err);
        var index, buf, rec;
        while ((index = data.indexOf(10)) > -1) {
            buf = Buffer.concat(bufs.concat([data.slice(0, index)]));
            bufs = [];
            data = data.slice(index + 1);
            try {
                rec = JSON.parse(buf.toString('utf-8'));
            } finally {
                if (isValidRecord(rec)) {
                    var time = new Date(rec.time);
                    lastUpdatedTime = time.valueOf();
                    if (opts.objectMode) {
                        rec.time = time;
                        that.push(rec);
                    } else {
                        that.push(JSON.stringify(rec) + '\n', 'utf-8');
                    }
                }
            }
        }
        if (data.length) {
            bufs.push(data);
        }
    };

    function onerror(err) {
        process.stderr.write('bunyan-sub-stream connection error:' +
            util.inspect(err) + '\n');
        that.socket.end();
    };

    function onend() {
        process.stderr.write('bunyan-sub-stream connection end\n');
        that.socket.close();
    };

    function reconnect() {
        destroy(that.socket);
        if (++retryCount > 20) {
            process.stderr.write(
                'can not connect to bunyan-hub for 1 minute, abort.\n');
            that.close();
            return;
        }
        firstTimeConnection = false;
        process.stderr.write('bunyan-sub-stream connection ended\n');
        process.stderr.write('will try reconnecting in 5s\n');
        setTimeout(function () {
            var socket = that.socket = net.connect(port, host);
            socket.on('connect', onconnect);
            socket.on('data', ondata);
            socket.on('error', onerror);
            //socket.on('end', onend);
            socket.on('close', reconnect);
        }, 5000);
    }

    function endSocket() {
        that.socket.removeListener('close', reconnect);
        that.socket.end();
        destroy(that.socket);
    };
    that.on('end', endSocket);
    return that;
}

SubStream.prototype._read = function () {
    return 0;
}

SubStream.prototype.close = function () {
    this.push(null);
}

module.exports = SubStream;
