'use strict';

var dgram = require('dgram');

var server;

exports.stop = function () {
    server.close();
};

exports.start = function (port, address, ipv6, callback) {
    var udp_version = ipv6 ? 'udp6' : 'udp4';
    server = dgram.createSocket(udp_version, callback);
    server.bind(port || 2013, address || undefined);
    return true;
};
