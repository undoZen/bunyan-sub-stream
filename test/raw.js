'use strict';
var SubStream = require('../');
var subStream = new SubStream({
    level: 'debug',
    raw: true,
});
subStream.on('data', function (data) {
    console.log(typeof data);
    console.log(data);
});
