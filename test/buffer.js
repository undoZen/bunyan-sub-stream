'use strict';
var SubStream = require('../');
var subStream = new SubStream({
    level: 'debug',
});
subStream.on('data', console.log.bind(console, 'data'));
subStream.pipe(process.stdout);
