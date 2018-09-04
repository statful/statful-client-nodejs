'use strict';

var https = require('https');
var zlib = require('zlib');
var fs = require('fs');

var options = {
    key: fs.readFileSync('./spec/certs/server-key.pem'),
    cert: fs.readFileSync('./spec/certs/server-cert.pem'),
    ciphers: 'ALL',
    secureProtocol: 'TLSv1_method'
};

var server;

exports.stop = function () {
    server.close();
};

exports.start = function (port, address, callback, responseCode, uncompress) {
    responseCode = responseCode || 201;
    uncompress = uncompress || false;

    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

    server = https.createServer(options, function (req, res) {
        var data = '';

        var pipe;

        if (uncompress) {
            pipe = zlib.createGunzip();
            req.pipe(pipe);
        } else {
            pipe = req;
        }

        pipe.on('data', function (chunk) {
            data += chunk.toString();
        });
        pipe.on('end', function () {
            callback(data);
            res.writeHead(responseCode);
            res.end('ok');
        });
    });

    server.listen(port, address);
};

exports.startWithError = function (port, address, callback) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

    server = https.createServer(options, function (req, res) {
        var data = '';
        req.on('data', function (chunk) {
            data += chunk.toString();
        });
        req.on('end', function () {
            callback(data);
            res.writeHead(500);
            res.end('HTTP/1.1 500 Internal Server Error\r\n\r\n');
        });
    });

    server.listen(port, address);
};
