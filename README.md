# bunyan-sub-stream
`bunyan-sub-stream` is a readable stream subscribes to [bunyan-hub](https://undozen.github.io/bunyan-hub) events.

## install

```bash
npm i --save bunyan-sub-stream
```

## usage

```javascript
var SubStream = require('bunyan-sub-stream');
var subStream = new SubStream({
    level: 'trace', // trace, debug, info, warn, error, fatal as in bunyan, default trace
    history: true, // read history, bunyan-hub will keep 1000 records for each level, default false
    time: timestamp, // if history is true, set time when the records emitted from history read, default undefined
    raw: false, // if set to true, subStream will be in objectMode and emit record object, defaults to false
});
subStream.on('data', console.log.bind(console, 'data'));
subStream.pipe(process.stdout);
```

## license
MIT
