'use strict';

/*jshint -W003 */

var Client = require('../lib/client');

var udpServer = require('./tools/udp-server');
var httpServer = require('./tools/http-server');
var logger = require('bunyan').createLogger({name: 'tests'});

var expect = require('chai').expect;
var sinon = require('sinon');

var udpPort = Math.floor(Math.random() * 10000) + 1000;
var httpPort = Math.floor(Math.random() * 20000) + 10001;

var apiConf = {
    host: '127.0.0.1',
    port: httpPort,
    token: 'my-token',
    secure: false
};

describe('When sending metrics', function () {

    it('should send metrics through UDP', function (done) {
        // Given
        udpServer.start(udpPort, '127.0.0.1', null, onResponse);

        var victim = new Client({
            systemStats: false,
            transport: 'udp',
            port: udpPort,
            flushSize: 1
        }, logger);

        // When
        victim.put('my_metric', 1);

        // Then
        function onResponse(lines) {
            udpServer.stop();

            expect(lines.toString()).to.match(/^application.my_metric 1 \d+$/);
            done();
        }
    });

    it('should send multiple metrics through UDP', function (done) {
        // Given
        udpServer.start(udpPort, '127.0.0.1', null, onResponse);

        var victim = new Client({
            systemStats: false,
            transport: 'udp',
            port: udpPort,
            flushSize: 2
        }, logger);

        // When
        victim.put('my_metric1', 1);
        victim.put('my_metric2', 1);

        // Then
        function onResponse(lines) {
            udpServer.stop();

            expect(lines.toString()).to.match(/^application.my_metric1 1 \d+\napplication.my_metric2 1 \d+$/);
            done();
        }
    });

    it('should send metrics through HTTP', function (done) {
        // Given
        httpServer.start(httpPort, '127.0.0.1', onResponse);

        var victim = new Client({
            systemStats: false,
            transport: 'http',
            api: apiConf,
            flushSize: 1
        }, logger);

        // When
        victim.put('my_metric', 1);

        // Then
        function onResponse(lines) {
            httpServer.stop();

            expect(lines).to.match(/^application.my_metric 1 \d+$/);
            done();
        }
    });

    it('should send compressed metrics through HTTP', function (done) {
        // Given
        httpServer.start(httpPort, '127.0.0.1', onResponse, 201, true);

        var victim = new Client({
            systemStats: false,
            transport: 'http',
            api: apiConf,
            compression: true,
            flushSize: 1
        }, logger);

        // When
        victim.put('my_metric', 1);

        // Then
        function onResponse(lines) {
            httpServer.stop();

            expect(lines).to.match(/^application.my_metric 1 \d+$/);
            done();
        }
    });

    it('should send metrics with fixed size flushes', function (done) {
        // Given
        httpServer.start(httpPort, '127.0.0.1', onResponse);

        var victim = new Client({
            systemStats: false,
            transport: 'http',
            api: apiConf,
            flushSize: 2
        }, logger);

        // When
        victim.put('my_metric1', 1);
        victim.put('my_metric2', 1);

        // Then
        function onResponse(lines) {
            httpServer.stop();

            expect(lines).to.match(/^application.my_metric1 1 \d+\napplication.my_metric2 1 \d+$/);
            done();
        }
    });

    it('should send metrics with configurable timed flushes', function (done) {
        // Given
        udpServer.start(udpPort, '127.0.0.1', null, onResponse);

        var victim = new Client({
            systemStats: false,
            transport: 'udp',
            port: udpPort,
            flushInterval: 10
        }, logger);

        // When
        victim.put('my_metric', 1);

        // Then
        function onResponse(lines) {
            udpServer.stop();

            expect(lines.toString()).to.match(/^application.my_metric 1 \d+$/);
            done();
        }
    });

    it('should send metrics with custom namespace', function (done) {
        // Given
        udpServer.start(udpPort, '127.0.0.1', null, onResponse);

        var victim = new Client({
            systemStats: false,
            transport: 'udp',
            port: udpPort,
            flushSize: 1
        }, logger);

        // When
        victim.put('my_metric', 1, {namespace: 'my_namespace'});

        // Then
        function onResponse(lines) {
            udpServer.stop();

            expect(lines.toString()).to.match(/^my_namespace.my_metric 1 \d+$/);
            done();
        }
    });

    it('should send metrics with custom configurable tags', function (done) {
        // Given
        udpServer.start(udpPort, '127.0.0.1', null, onResponse);

        var victim = new Client({
            systemStats: false,
            transport: 'udp',
            port: udpPort,
            flushSize: 1,
            tags: {cluster: 'test'}
        }, logger);

        // When
        victim.put('my_metric', 1);

        // Then
        function onResponse(lines) {
            udpServer.stop();

            expect(lines.toString()).to.match(/^application\.my_metric,cluster=test 1 \d+$/);
            done();
        }
    });

    it('should send metrics with custom configurable application tag', function (done) {
        // Given
        udpServer.start(udpPort, '127.0.0.1', null, onResponse);

        var victim = new Client({
            systemStats: false,
            transport: 'udp',
            port: udpPort,
            flushSize: 1,
            app: 'test'
        }, logger);

        // When
        victim.put('my_metric', 1);

        // Then
        function onResponse(lines) {
            udpServer.stop();

            expect(lines.toString()).to.match(/^application\.my_metric,app=test 1 \d+$/);
            done();
        }
    });

    it('should send metrics with sample rate', function (done) {
        // Given
        udpServer.start(udpPort, '127.0.0.1', null, onResponse);

        var victim = new Client({
            systemStats: false,
            transport: 'udp',
            port: udpPort,
            flushSize: 1
        }, logger);

        // When
        victim.put('my_metric', 1, {tags: {}, agg: ['avg'], aggFreq: 10, sampleRate: 100});

        // Then
        function onResponse(lines) {
            udpServer.stop();

            expect(lines.toString()).to.match(/^application.my_metric 1 \d+ avg,10 100$/);
            done();
        }
    });

    it('should send metrics with sampled rate', function (done) {
        // Given
        var randomStub = sinon.stub(Math, 'random').returns(1);

        udpServer.start(udpPort, '127.0.0.1', null, onResponse);

        var victim = new Client({
            systemStats: false,
            transport: 'udp',
            port: udpPort,
            flushSize: 2
        }, logger);

        // When
        victim.put('my_metric', 1, {agg: ['avg'], aggFreq: 10, sampleRate: 100});
        victim.put('my_metric', 1, { agg: ['avg'], aggFreq: 10, sampleRate: 1});

        // Then
        function onResponse(lines) {
            udpServer.stop();
            randomStub.restore();

            expect(lines.toString()).to.match(/^application.my_metric 1 \d+ avg,10 100$/);

            done();
        }
    });

    it('should throw exception when api token is not configured', function() {
        var conf = {
            systemStats: false,
            transport: 'http',
            api: {
                host: '127.0.0.1',
                port: httpPort,
                secure: false
            },
            flushSize: 1
        };

        expect(Client.bind(Client, conf, logger)).to.throw('Telemetron API Token not defined');
    });

    it('should handle HTTP errors', function (done) {
        // Given
        httpServer.startWithError(httpPort, '127.0.0.1', onResponse);

        var victim = new Client({
            systemStats: false,
            transport: 'http',
            api: apiConf,
            flushSize: 1
        }, logger);

        // When
        victim.put('my_metric', 1);

        // Then
        function onResponse(lines) {
            httpServer.stop();

            expect(lines).to.match(/^application.my_metric 1 \d+$/);
            done();
        }
    });

    it('should close client', function () {
        var victim = new Client({}, logger);

        sinon.spy(victim, "close");

        // When
        victim.close();

        // Then
        /*jshint -W030 */
        expect(victim.close.calledOnce).to.be.truthy;
        victim.close.restore();
    });

    it('should configure global namespace', function (done) {
        // Given
        udpServer.start(udpPort, '127.0.0.1', null, onResponse);

        var victim = new Client({
            systemStats: false,
            transport: 'udp',
            port: udpPort,
            flushSize: 1,
            namespace: 'my_namespace'
        }, logger);

        // When
        victim.put('my_metric', 1);

        // Then
        function onResponse(lines) {
            udpServer.stop();

            expect(lines.toString()).to.match(/^my_namespace.my_metric 1 \d+$/);
            done();
        }
    });

    it('should override global configuration', function (done) {
        // Given
        udpServer.start(udpPort, '127.0.0.1', null, onResponse);

        var victim = new Client({
            systemStats: false,
            transport: 'udp',
            port: udpPort,
            flushSize: 1,
            namespace: 'my_namespace'
        }, logger);

        // When
        victim.put('my_metric', 1, {namespace: 'my_other_namespace'});

        // Then
        function onResponse(lines) {
            udpServer.stop();

            expect(lines.toString()).to.match(/^my_other_namespace.my_metric 1 \d+$/);
            done();
        }
    });

    it('should handle empty default config', function (done) {
        // Given
        udpServer.start(udpPort, '127.0.0.1', null, onResponse);

        var victim = new Client({
            systemStats: false,
            transport: 'udp',
            port: udpPort,
            flushSize: 1,
            default: {}
        }, logger);

        // When
        victim.put('my_metric', 1);

        // Then
        function onResponse(lines) {
            udpServer.stop();

            expect(lines.toString()).to.match(/^application.my_metric 1 \d+$/);
            done();
        }
    });

    it('should instantiate client without logger', function (done) {
        // Given
        udpServer.start(udpPort, '127.0.0.1', null, onResponse);

        var victim = new Client({
            systemStats: false,
            transport: 'udp',
            port: udpPort,
            flushSize: 1
        });

        // When
        victim.put('my_metric', 1);

        // Then
        function onResponse(lines) {
            udpServer.stop();

            expect(lines.toString()).to.match(/^application.my_metric 1 \d+$/);
            done();
        }
    });

    it('should throw when aggregation frequency configuration is invalid', function () {
        var conf = {
            systemStats: false,
            transport: 'udp',
            port: udpPort,
            flushSize: 1,
            default: {
                counter: {
                    aggFreq: {}
                }
            }
        };

        expect(Client.bind(Client, conf)).to.throw('Metric type configuration is invalid, please read the documentation');
    });

    it('should throw when aggregation configuration is invalid', function () {
        var conf = {
            systemStats: false,
            transport: 'udp',
            port: udpPort,
            flushSize: 1,
            default: {
                counter: {
                    agg: {}
                }
            }
        };

        expect(Client.bind(Client, conf)).to.throw('Metric type configuration is invalid, please read the documentation');
    });

    it('should throw when tag configuration is invalid', function () {
        var conf = {
            systemStats: false,
            transport: 'udp',
            port: udpPort,
            flushSize: 1,
            default: {
                counter: {
                    tags: []
                }
            }
        };

        expect(Client.bind(Client, conf)).to.throw('Metric type configuration is invalid, please read the documentation');
    });

    it('should throw when aggregation type is invalid', function () {
        var conf = {
            systemStats: false,
            transport: 'udp',
            port: udpPort,
            flushSize: 1,
            default: {
                counter: {
                    agg: ['sum', 'non existent']
                }
            }
        };

        expect(Client.bind(Client, conf)).to.throw('Metric type configuration is invalid, please read the documentation');
    });
});