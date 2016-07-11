'use strict';

/*jshint -W003 */

var Client = require('../lib/client');

var udpServer = require('./tools/udp-server');
var logger = require('bunyan').createLogger({name: 'tests'});

var expect = require('chai').expect;

describe('When sending gauge metrics', function () {

    var udpPort = Math.floor(Math.random() * 10000) + 1000;

    var victim = new Client({
        systemStats: false,
        autoDiagnostics: false,
        transport: 'udp',
        port: udpPort,
        flushSize: 1
    }, logger);

    it('should send simple gauge with defaults', function (done) {
        // Given
        udpServer.start(udpPort, '127.0.0.1', null, onResponse);

        // When
        victim.gauge('my_metric', 1);

        // Then
        function onResponse(lines) {
            expect(lines.toString()).to.match(/^application.gauge.my_metric \d+ \d+ last,10$/);
            udpServer.stop();
            done();
        }
    });
    
    it('should send gauge with custom aggregations', function (done) {
        // Given
        udpServer.start(udpPort, '127.0.0.1', null, onResponse);
    
        // When
        victim.gauge('my_metric', 1, {}, ['avg']);
    
        // Then
        function onResponse(lines) {
            expect(lines.toString()).to.match(/^application.gauge.my_metric 1 \d+ avg,10$/);
            udpServer.stop();
            done();
        }
    });
    
    it('should send gauge with custom tags', function (done) {
        // Given
        udpServer.start(udpPort, '127.0.0.1', null, onResponse);
    
        // When
        victim.gauge('my_metric', 1, {cluster: 'test'});
    
        // Then
        function onResponse(lines) {
            expect(lines.toString()).to.match(/^application.gauge.my_metric,cluster=test 1 \d+ last,10$/);
            udpServer.stop();
            done();
        }
    });
    
    it('should send gauge with custom aggregation frequency', function (done) {
        // Given
        udpServer.start(udpPort, '127.0.0.1', null, onResponse);
    
        // When
        victim.gauge('my_metric', 1, {}, null, 100);
    
        // Then
        function onResponse(lines) {
            expect(lines.toString()).to.match(/^application.gauge.my_metric 1 \d+ last,100$/);
            udpServer.stop();
            done();
        }
    });
});