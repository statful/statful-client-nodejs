'use strict';

/*jshint -W003 */

var Client = require('../lib/client');

var udpServer = require('./tools/udp-server');
var logger = require('bunyan').createLogger({name: 'tests'});

var expect = require('chai').expect;

describe('When sending timer metrics', function () {

    var udpPort = Math.floor(Math.random() * 10000) + 1000;

    var victim = new Client({
        systemStats: false,
        transport: 'udp',
        port: udpPort,
        flushSize: 1
    }, logger);

    it('should send simple timer with defaults', function (done) {
        // Given
        udpServer.start(udpPort, '127.0.0.1', null, onResponse);

        // When
        victim.timer('my_metric', 1);

        // Then
        function onResponse(lines) {
            udpServer.stop();

            expect(lines.toString()).to.match(/^application.timer.my_metric,unit=ms 1 \d+ avg,p90,count,10$/);
            done();
        }
    });

    it('should send timer with custom aggregations', function (done) {
        // Given
        udpServer.start(udpPort, '127.0.0.1', null, onResponse);

        // When
        victim.timer('my_metric', 1, {agg: ['last']});

        // Then
        function onResponse(lines) {
            udpServer.stop();

            expect(lines.toString()).to.match(/^application.timer.my_metric,unit=ms 1 \d+ avg,p90,count,last,10$/);
            done();
        }
    });

    it('should send timer with custom tags', function (done) {
        // Given
        udpServer.start(udpPort, '127.0.0.1', null, onResponse);

        // When
        victim.timer('my_metric', 1, {tags: {cluster: 'test'}});

        // Then
        function onResponse(lines) {
            udpServer.stop();
            expect(lines.toString()).to.match(/^application.timer.my_metric,cluster=test,unit=ms 1 \d+ avg,p90,count,10$/);
            done();
        }
    });

    it('should send timer with custom aggregation frequency', function (done) {
        // Given
        udpServer.start(udpPort, '127.0.0.1', null, onResponse);

        // When
        victim.timer('my_metric', 1, {aggFreq: 100});

        // Then
        function onResponse(lines) {
            udpServer.stop();

            expect(lines.toString()).to.match(/^application.timer.my_metric,unit=ms 1 \d+ avg,p90,count,100$/);
            done();
        }
    });

    it('should configure default tags for timers', function (done) {
        // Given
        udpServer.start(udpPort, '127.0.0.1', null, onResponse);

        var victim = new Client({
            systemStats: false,
            transport: 'udp',
            port: udpPort,
            flushSize: 1,
            default: {
                timer: {
                    tags: {cluster: 'test'}
                }
            }
        }, logger);

        // When
        victim.timer('my_metric', 1);

        // Then
        function onResponse(lines) {
            udpServer.stop();

            expect(lines.toString()).to.match(/^application.timer.my_metric,cluster=test 1 \d+ avg,p90,count,10$/);
            done();
        }
    });

    it('should merge default timer tags', function (done) {
        // Given
        udpServer.start(udpPort, '127.0.0.1', null, onResponse);

        var victim = new Client({
            systemStats: false,
            transport: 'udp',
            port: udpPort,
            flushSize: 1,
            default: {
                timer: {
                    tags: { env: 'qa' }
                }
            }
        }, logger);

        // When
        victim.timer('my_metric', 1, {tags: {cluster: 'test'}});

        // Then
        function onResponse(lines) {
            udpServer.stop();

            expect(lines.toString()).to.match(/^application.timer.my_metric,cluster=test,env=qa 1 \d+ avg,p90,count,10$/);
            done();
        }
    });

    it('should configure default aggregations for timers', function (done) {
        // Given
        udpServer.start(udpPort, '127.0.0.1', null, onResponse);

        var victim = new Client({
            systemStats: false,
            transport: 'udp',
            port: udpPort,
            flushSize: 1,
            default: {
                timer: {
                    agg: ['sum']
                }
            }
        }, logger);

        // When
        victim.timer('my_metric', 1);

        // Then
        function onResponse(lines) {
            udpServer.stop();

            expect(lines.toString()).to.match(/^application.timer.my_metric,unit=ms 1 \d+ sum,10$/);
            done();
        }
    });


    it('should configure default aggregation frequency for timers', function (done) {
        // Given
        udpServer.start(udpPort, '127.0.0.1', null, onResponse);

        var victim = new Client({
            systemStats: false,
            transport: 'udp',
            port: udpPort,
            flushSize: 1,
            default: {
                timer: {
                    aggFreq: 100
                }
            }
        }, logger);

        // When
        victim.timer('my_metric', 1);

        // Then
        function onResponse(lines) {
            udpServer.stop();

            expect(lines.toString()).to.match(/^application.timer.my_metric,unit=ms 1 \d+ avg,p90,count,100$/);
            done();
        }
    });

    it('should override default timer aggregation frequency', function (done) {
        // Given
        udpServer.start(udpPort, '127.0.0.1', null, onResponse);

        var victim = new Client({
            systemStats: false,
            transport: 'udp',
            port: udpPort,
            flushSize: 1,
            default: {
                timer: {
                    aggFreq: 99
                }
            }
        }, logger);

        // When
        victim.timer('my_metric', 1, {aggFreq: 100});

        // Then
        function onResponse(lines) {
            udpServer.stop();

            expect(lines.toString()).to.match(/^application.timer.my_metric,unit=ms 1 \d+ avg,p90,count,100$/);
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
        victim.timer('my_metric', 1, {agg: ['sum']});

        // Then
        function onResponse(lines) {
            udpServer.stop();

            expect(lines.toString()).to.match(/^application.timer.my_metric,unit=ms 1 \d+ avg,p90,count,sum,10$/);
            done();
        }
    });

    it('should handle empty default timer config', function (done) {
        // Given
        udpServer.start(udpPort, '127.0.0.1', null, onResponse);

        var victim = new Client({
            systemStats: false,
            transport: 'udp',
            port: udpPort,
            flushSize: 1,
            default: { timer: {}}
        }, logger);

        // When
        victim.timer('my_metric', 1);

        // Then
        function onResponse(lines) {
            udpServer.stop();

            expect(lines.toString()).to.match(/^application.timer.my_metric,unit=ms 1 \d+ avg,p90,count,10$/);
            done();
        }
    });
});
