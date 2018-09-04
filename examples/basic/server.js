var http = require('http');
var Statful = require('../../lib/client.js');

// Creates an object with the configuration and pass it to the client
var config = {
    app: 'basic-http-server-statful',
    transport: 'api',
    flushInterval: 1000,
    systemStats: true,
    api: {
        token: '',
        host: ''
    },
    tags: { environment: 'qa' }
};
var statful = new Statful(config);

//create a server object:
http.createServer((req, res) => {
    statful.counter('request', 1);
    res.write('Hello World!');
    res.end();
}).listen(8080);

console.log('Application Started');
