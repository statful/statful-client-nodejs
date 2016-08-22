'use strict';

/*jshint -W003 */

var Client = require('../lib/client');

var udpServer = require('./tools/udp-server');
var httpsServer = require('./tools/https-server');
var logger = require('bunyan').createLogger({name: 'tests'});

var expect = require('chai').expect;

describe('When sending gauge metrics', function () {
    var httpPort = Math.floor(Math.random() * 20000) + 10001;
    var udpPort = Math.floor(Math.random() * 10000) + 1000;
    var apiConf = {
        host: '127.0.0.1',
        port: httpPort,
        token: 'my-token'
    };

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
        victim.gauge('my_metric', 1, {agg: ['avg']});
    
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
        victim.gauge('my_metric', 1, {tags: {cluster: 'test'}});
    
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
        victim.gauge('my_metric', 1, {aggFreq: 120});
    
        // Then
        function onResponse(lines) {
            udpServer.stop();

            expect(lines.toString()).to.match(/^application.gauge.my_metric 1 \d+ last,120$/);
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
        victim.gauge('my_metric', 1, {tags: {cluster: 'test'}});

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
                    aggFreq: 120
                }
            }
        }, logger);

        // When
        victim.gauge('my_metric', 1);

        // Then
        function onResponse(lines) {
            udpServer.stop();

            expect(lines.toString()).to.match(/^application.gauge.my_metric 1 \d+ last,120$/);
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
                    aggFreq: 60
                }
            }
        }, logger);

        // When
        victim.gauge('my_metric', 1, {aggFreq: 120});

        // Then
        function onResponse(lines) {
            udpServer.stop();

            expect(lines.toString()).to.match(/^application.gauge.my_metric 1 \d+ last,120$/);
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
        victim.gauge('my_metric', 1, {agg: ['sum']});

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

    it('should send aggregated gauge', function (done) {
        // Given
        httpsServer.start(httpPort, '127.0.0.1', onResponse, 201, true);

        var victim = new Client({
            systemStats: false,
            transport: 'api',
            api: apiConf,
            compression: true,
            flushSize: 2
        }, logger);

        // When
        victim.aggregatedGauge('my_metric1', 1, 'avg', 60);
        victim.aggregatedGauge('my_metric2', 1, 'avg', 60);

        // Then
        function onResponse(lines) {
            httpsServer.stop();

            expect(lines.toString()).to.match(/^application\.gauge\.my_metric1 1 \d+\napplication\.gauge\.my_metric2 1 \d+$/);
            done();
        }
    });
});