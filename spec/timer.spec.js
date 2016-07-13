'use strict';

/*jshint -W003 */

var Client = require('../lib/client');

var udpServer = require('./tools/udp-server');
var logger = require('bunyan').createLogger({name: 'tests'});

var expect = require('chai').expect;

describe('When sending timer metrics', function () {

    var victim = new Client({
        systemStats: false,
        autoDiagnostics: false,
        transport: 'udp',
        flushSize: 1
    }, logger);

    it('should send simple timer with defaults', function (done) {
        // Given
        udpServer.start(2013, '127.0.0.1', null, onResponse);

        // When
        victim.time('my_metric', 1);

        // Then
        function onResponse(lines) {
            expect(lines.toString()).to.match(/^application.timer.my_metric,unit=ms 1 \d+ avg,p90,count,10$/);
            udpServer.stop();
            done();
        }
    });

    it('should send timer with custom aggregations', function (done) {
        // Given
        udpServer.start(2013, '127.0.0.1', null, onResponse);

        // When
        victim.time('my_metric', 1, {}, ['avg']);

        // Then
        function onResponse(lines) {
            expect(lines.toString()).to.match(/^application.timer.my_metric,unit=ms 1 \d+ avg,10$/);
            udpServer.stop();
            done();
        }
    });

    it('should send timer with custom tags', function (done) {
        // Given
        udpServer.start(2013, '127.0.0.1', null, onResponse);

        // When
        victim.time('my_metric', 1, {cluster: 'test'});

        // Then
        function onResponse(lines) {
            expect(lines.toString()).to.match(/^application.timer.my_metric,unit=ms,cluster=test 1 \d+ avg,p90,count,10$/);
            udpServer.stop();
            done();
        }
    });

    it('should send timer with custom aggregation frequency', function (done) {
        // Given
        udpServer.start(2013, '127.0.0.1', null, onResponse);

        // When
        victim.time('my_metric', 1, {}, null, 100);

        // Then
        function onResponse(lines) {
            expect(lines.toString()).to.match(/^application.timer.my_metric,unit=ms 1 \d+ avg,p90,count,100$/);
            udpServer.stop();
            done();
        }
    });
});