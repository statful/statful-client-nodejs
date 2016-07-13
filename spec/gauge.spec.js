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
            udpServer.stop();

            expect(lines.toString()).to.match(/^application.gauge.my_metric \d+ \d+ last,10$/);
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
            udpServer.stop();

            expect(lines.toString()).to.match(/^application.gauge.my_metric 1 \d+ last,avg,10$/);
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
            udpServer.stop();

            expect(lines.toString()).to.match(/^application.gauge.my_metric,cluster=test 1 \d+ last,10$/);
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
            udpServer.stop();

            expect(lines.toString()).to.match(/^application.gauge.my_metric 1 \d+ last,100$/);
            done();
        }
    });

    it('should configure default tags for gauges', function (done) {
        // Given
        udpServer.start(udpPort, '127.0.0.1', null, onResponse);

        var victim = new Client({
            systemStats: false,
            transport: 'udp',
            port: udpPort,
            flushSize: 1,
            default: {
                gauge: {
                    tags: {cluster: 'test'}
                }
            }
        }, logger);

        // When
        victim.gauge('my_metric', 1);

        // Then
        function onResponse(lines) {
            udpServer.stop();

            expect(lines.toString()).to.match(/^application.gauge.my_metric,cluster=test 1 \d+ last,10$/);
            done();
        }
    });

    it('should merge default gauge tags', function (done) {
        // Given
        udpServer.start(udpPort, '127.0.0.1', null, onResponse);

        var victim = new Client({
            systemStats: false,
            transport: 'udp',
            port: udpPort,
            flushSize: 1,
            default: {
                gauge: {
                    tags: { env: 'qa' }
                }
            }
        }, logger);

        // When
        victim.gauge('my_metric', 1, {cluster: 'test'});

        // Then
        function onResponse(lines) {
            udpServer.stop();

            expect(lines.toString()).to.match(/^application.gauge.my_metric,cluster=test,env=qa 1 \d+ last,10$/);
            done();
        }
    });

    it('should configure default aggregations for gauges', function (done) {
        // Given
        udpServer.start(udpPort, '127.0.0.1', null, onResponse);

        var victim = new Client({
            systemStats: false,
            transport: 'udp',
            port: udpPort,
            flushSize: 1,
            default: {
                gauge: {
                    agg: ['sum']
                }
            }
        }, logger);

        // When
        victim.gauge('my_metric', 1);

        // Then
        function onResponse(lines) {
            udpServer.stop();

            expect(lines.toString()).to.match(/^application.gauge.my_metric 1 \d+ sum,10$/);
            done();
        }
    });


    it('should configure default aggregation frequency for gauges', function (done) {
        // Given
        udpServer.start(udpPort, '127.0.0.1', null, onResponse);

        var victim = new Client({
            systemStats: false,
            transport: 'udp',
            port: udpPort,
            flushSize: 1,
            default: {
                gauge: {
                    aggFreq: 100
                }
            }
        }, logger);

        // When
        victim.gauge('my_metric', 1);

        // Then
        function onResponse(lines) {
            udpServer.stop();

            expect(lines.toString()).to.match(/^application.gauge.my_metric 1 \d+ last,100$/);
            done();
        }
    });

    it('should override default gauge aggregation frequency', function (done) {
        // Given
        udpServer.start(udpPort, '127.0.0.1', null, onResponse);

        var victim = new Client({
            systemStats: false,
            transport: 'udp',
            port: udpPort,
            flushSize: 1,
            default: {
                gauge: {
                    aggFreq: 99
                }
            }
        }, logger);

        // When
        victim.gauge('my_metric', 1, null, null, 100);

        // Then
        function onResponse(lines) {
            udpServer.stop();

            expect(lines.toString()).to.match(/^application.gauge.my_metric 1 \d+ last,100$/);
            done();
        }
    });

    it('should merge unique aggregations', function (done) {
        // Given
        udpServer.start(udpPort, '127.0.0.1', null, onResponse);

        var victim = new Client({
            systemStats: false,
            transport: 'udp',
            port: udpPort,
            flushSize: 1
        }, logger);

        // When
        victim.gauge('my_metric', 1, {}, ['sum']);

        // Then
        function onResponse(lines) {
            udpServer.stop();

            expect(lines.toString()).to.match(/^application.gauge.my_metric 1 \d+ last,sum,10$/);
            done();
        }
    });

    it('should handle empty default gauge config', function (done) {
        // Given
        udpServer.start(udpPort, '127.0.0.1', null, onResponse);

        var victim = new Client({
            systemStats: false,
            transport: 'udp',
            port: udpPort,
            flushSize: 1,
            default: { gauge: {}}
        }, logger);

        // When
        victim.gauge('my_metric', 1);

        // Then
        function onResponse(lines) {
            udpServer.stop();

            expect(lines.toString()).to.match(/^application.gauge.my_metric 1 \d+ last,10$/);
            done();
        }
    });
});