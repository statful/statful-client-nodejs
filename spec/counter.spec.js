'use strict';

/*jshint -W003 */

var Client = require('../lib/client');

var udpServer = require('./tools/udp-server');
var httpsServer = require('./tools/https-server');
var logger = require('bunyan').createLogger({ name: 'tests' });

var expect = require('chai').expect;

describe('When sending counter metrics', function () {
    var httpPort = Math.floor(Math.random() * 10000) + 11025;
    var udpPort = Math.floor(Math.random() * 10000) + 1024;
    var apiConf = {
        host: '127.0.0.1',
        port: httpPort,
        token: 'my-token'
    };

    var victim = new Client(
        {
            systemStats: false,
            transport: 'udp',
            port: udpPort,
            flushSize: 1
        },
        logger
    );

    it('should send simple counter with defaults', function (done) {
        // Given
        udpServer.start(udpPort, '127.0.0.1', null, onResponse);

        // When
        victim.counter('my_metric', 1);

        // Then
        function onResponse (lines) {
            udpServer.stop();

            expect(lines.toString()).to.match(/^application.counter.my_metric \d+ \d+ sum,count,10$/);
            done();
        }
    });

    it('should send counter with custom aggregations', function (done) {
        // Given
        udpServer.start(udpPort, '127.0.0.1', null, onResponse);

        // When
        victim.counter('my_metric', 1, { agg: ['avg'] });

        // Then
        function onResponse (lines) {
            udpServer.stop();

            expect(lines.toString()).to.match(/^application.counter.my_metric 1 \d+ sum,count,avg,10$/);
            done();
        }
    });

    it('should send counter with custom tags', function (done) {
        // Given
        udpServer.start(udpPort, '127.0.0.1', null, onResponse);

        // When
        victim.counter('my_metric', 1, { tags: { cluster: 'test' } });

        // Then
        function onResponse (lines) {
            udpServer.stop();

            expect(lines.toString()).to.match(/^application.counter.my_metric,cluster=test 1 \d+ sum,count,10$/);
            done();
        }
    });

    it('should send counter with custom aggregation frequency', function (done) {
        // Given
        udpServer.start(udpPort, '127.0.0.1', null, onResponse);

        // When
        victim.counter('my_metric', 1, { aggFreq: 120 });

        // Then
        function onResponse (lines) {
            udpServer.stop();

            expect(lines.toString()).to.match(/^application.counter.my_metric 1 \d+ sum,count,120$/);
            done();
        }
    });

    it('should configure default tags for counters', function (done) {
        // Given
        udpServer.start(udpPort, '127.0.0.1', null, onResponse);

        var victim = new Client(
            {
                systemStats: false,
                transport: 'udp',
                port: udpPort,
                flushSize: 1,
                default: {
                    counter: {
                        tags: { cluster: 'test' }
                    }
                }
            },
            logger
        );

        // When
        victim.counter('my_metric', 1);

        // Then
        function onResponse (lines) {
            udpServer.stop();

            expect(lines.toString()).to.match(/^application.counter.my_metric,cluster=test 1 \d+ sum,count,10$/);
            done();
        }
    });

    it('should merge default counter tags', function (done) {
        // Given
        udpServer.start(udpPort, '127.0.0.1', null, onResponse);

        var victim = new Client(
            {
                systemStats: false,
                transport: 'udp',
                port: udpPort,
                flushSize: 1,
                default: {
                    counter: {
                        tags: { env: 'qa' }
                    }
                }
            },
            logger
        );

        // When
        victim.counter('my_metric', 1, { tags: { cluster: 'test' } });

        // Then
        function onResponse (lines) {
            udpServer.stop();

            expect(lines.toString()).to.match(/^application.counter.my_metric,cluster=test,env=qa 1 \d+ sum,count,10$/);
            done();
        }
    });

    it('should configure default aggregations for counters', function (done) {
        // Given
        udpServer.start(udpPort, '127.0.0.1', null, onResponse);

        var victim = new Client(
            {
                systemStats: false,
                transport: 'udp',
                port: udpPort,
                flushSize: 1,
                default: {
                    counter: {
                        agg: ['sum']
                    }
                }
            },
            logger
        );

        // When
        victim.counter('my_metric', 1);

        // Then
        function onResponse (lines) {
            udpServer.stop();

            expect(lines.toString()).to.match(/^application.counter.my_metric 1 \d+ sum,10$/);
            done();
        }
    });

    it('should configure default aggregation frequency for counters', function (done) {
        // Given
        udpServer.start(udpPort, '127.0.0.1', null, onResponse);

        var victim = new Client(
            {
                systemStats: false,
                transport: 'udp',
                port: udpPort,
                flushSize: 1,
                default: {
                    counter: {
                        aggFreq: 120
                    }
                }
            },
            logger
        );

        // When
        victim.counter('my_metric', 1);

        // Then
        function onResponse (lines) {
            udpServer.stop();

            expect(lines.toString()).to.match(/^application.counter.my_metric 1 \d+ sum,count,120$/);
            done();
        }
    });

    it('should override default counter aggregation frequency', function (done) {
        // Given
        udpServer.start(udpPort, '127.0.0.1', null, onResponse);

        var victim = new Client(
            {
                systemStats: false,
                transport: 'udp',
                port: udpPort,
                flushSize: 1,
                default: {
                    counter: {
                        aggFreq: 60
                    }
                }
            },
            logger
        );

        // When
        victim.counter('my_metric', 1, { aggFreq: 120 });

        // Then
        function onResponse (lines) {
            udpServer.stop();

            expect(lines.toString()).to.match(/^application.counter.my_metric 1 \d+ sum,count,120$/);
            done();
        }
    });

    it('should merge unique aggregations', function (done) {
        // Given
        udpServer.start(udpPort, '127.0.0.1', null, onResponse);

        var victim = new Client(
            {
                systemStats: false,
                transport: 'udp',
                port: udpPort,
                flushSize: 1
            },
            logger
        );

        // When
        victim.counter('my_metric', 1, { agg: ['sum'] });

        // Then
        function onResponse (lines) {
            udpServer.stop();

            expect(lines.toString()).to.match(/^application.counter.my_metric 1 \d+ sum,count,10$/);
            done();
        }
    });

    it('should handle empty default counter config', function (done) {
        // Given
        udpServer.start(udpPort, '127.0.0.1', null, onResponse);

        var victim = new Client(
            {
                systemStats: false,
                transport: 'udp',
                port: udpPort,
                flushSize: 1,
                default: { counter: {} }
            },
            logger
        );

        // When
        victim.counter('my_metric', 1);

        // Then
        function onResponse (lines) {
            udpServer.stop();

            expect(lines.toString()).to.match(/^application.counter.my_metric 1 \d+ sum,count,10$/);
            done();
        }
    });

    it('should send aggregated counter', function (done) {
        // Given
        httpsServer.start(httpPort, '127.0.0.1', onResponse, 201, true);

        var victim = new Client(
            {
                systemStats: false,
                transport: 'api',
                api: apiConf,
                compression: true,
                flushSize: 2
            },
            logger
        );

        // When
        victim.aggregatedCounter('my_metric1', 1, 'avg', 60);
        victim.aggregatedCounter('my_metric2', 1, 'avg', 60);

        // Then
        function onResponse (lines) {
            httpsServer.stop();

            expect(lines.toString()).to.match(
                /^application\.counter\.my_metric1 1 \d+\napplication\.counter\.my_metric2 1 \d+$/
            );
            done();
        }
    });
});
