'use strict';
var SubStream = require('../');
var subStream = new SubStream({
    level: 'debug',
    encoding: 'utf-8',
});
subStream.pipe(process.stdout);
subStream.on('end', console.log.bind(console, 'end'));
setTimeout(function () {
    subStream.close();
}, 5000);
