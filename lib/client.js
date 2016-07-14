'use strict';

var dgram = require('dgram'),
    blocked = require('blocked'),
    request = require('request'),
    merge = require('merge'),
    zlib = require('zlib'),
    Readable = require('stream').Readable,
    configHelper = require('./config-helper');

/**
 * The Client for Statful.
 *
 * @param config Client configuration object
 * @param logger A logger instance
 * @constructor
 */
var Client = function (config, logger) {
    var self = this;
    this.logger = logger;

    config = config || {};

    this.transport = config.transport || 'udp';

    switch (this.transport) {
        case 'udp':
            this.host = (config.udp && config.udp.host) || config.host || '127.0.0.1';
            this.port = (config.udp && config.udp.port) || config.port || 2013;
            this.socket = dgram.createSocket('udp4');
            break;
        case 'http':
            if (!config.api || !config.api.token) {
                throw 'Statful API Token not defined';
            }
            this.host = config.api.host || 'api.beta.telemetron.io';
            this.port = config.api.port || 443;
            this.secure = (config.api.secure !== undefined) ? config.api.secure : true;
            this.protocol = this.secure ? 'https' : 'http';
            this.path = config.api.path || '/tel/v2.0/metrics';
            this.timeout = config.api.timeout || 2000;
            this.token = config.token || config.api.token;
            break;
    }

    this.app = config.app;
    this.namespace = config.namespace || 'application';
    this.dryRun = config.dryRun;
    this.tags = config.tags || {};
    this.systemStats = (config.systemStats !== undefined) ? config.systemStats : true;
    this.sampleRate = config.sampleRate || false;
    this.flushInterval = config.flushInterval || 500;
    this.flushSize = config.flushSize || 10;
    this.compression = config.compression || false;

    this.default = {};
    this.default.timer = {
        agg: ['avg', 'p90', 'count'],
        tags: {unit: 'ms'}
    };
    this.default.counter = {
        agg: ['sum', 'count']
    };
    this.default.gauge = {
        agg: ['last']
    };

    configHelper.overrideMetricDefaultConfigs(this.default, config.default);

    this.buffer = '';
    this.bufferSize = 0;

    if (this.systemStats) {
        blocked(function (ms) {
            self.time('event_loop', ms);
        });
    }

    setInterval(function (obj) {
        obj.flush();
    }, config.flushInterval, this);

};

function putMetricType(self, metricTypeConf, name, value, parameters) {
    var metricParams = parameters || {};

    var tags = metricParams.tags,
        agg = metricParams.agg,
        aggFreq = metricParams.aggFreq,
        namespace = metricParams.namespace;

    if (configHelper.areMetricTypesArgumentsValid(agg, aggFreq, tags)) {
        var putAgg = configHelper.concatAggregations(metricTypeConf.agg, agg),
            putTags = merge(tags, metricTypeConf.tags),
            putAggFreq = aggFreq || metricTypeConf.aggFreq;

        self.put(name, value, {tags: putTags, agg: putAgg, aggFreq: putAggFreq, sampleRate: self.sampleRate, namespace: namespace});
    } else if (self.logger) {
        self.logger.warn('Metric not sent. Please review the following: aggregations, aggregation frequency and tags');
    }
}

/**
 * Sends a timing metric
 *
 * @param name Name of the counter. Ex: response_time
 * @param value
 * @param parameters An object with metric para meters: tags, agg, aggFreq and namespace
 *          - tags: Tags to associate this value with, for example {from: 'serviceA', to: 'serviceB', method: 'login'}
 *          - agg: List of aggregations to be applied by the Statful. Ex: ['avg', 'p90', 'min']
 *          - aggFreq: Aggregation frequency in seconds. One of: 10, 15, 30, 60 or 300
 *          - namespace: Define the metric namespace. Default: application
 */
Client.prototype.time = function (name, value, parameters) {
    putMetricType(this, this.default.timer, 'timer.' + name, value, parameters);
};

/**
 * Increments a counter
 *
 * @param name Name of the counter. Ex: transactions
 * @param value
 * @param parameters An object with metric para meters: tags, agg, aggFreq and namespace
 *          - tags: Tags to associate this value with, for example {from: 'serviceA', to: 'serviceB', method: 'login'}
 *          - agg: List of aggregations to be applied by the Statful. Ex: ['avg', 'p90', 'min']
 *          - aggFreq: Aggregation frequency in seconds. One of: 10, 15, 30, 60 or 300
 *          - namespace: Define the metric namespace. Default: application
 */
Client.prototype.counter = function (name, value, parameters) {
    putMetricType(this, this.default.counter, 'counter.' + name, value, parameters);
};

/**
 * Adds a Gauge
 * @param name Name of the Gauge. Ex: current_sessions
 * @param value
 * @param parameters An object with metric para meters: tags, agg, aggFreq and namespace
 *          - tags: Tags to associate this value with, for example {from: 'serviceA', to: 'serviceB', method: 'login'}
 *          - agg: List of aggregations to be applied by the Statful. Ex: ['avg', 'p90', 'min']
 *          - aggFreq: Aggregation frequency in seconds. One of: 10, 15, 30, 60 or 300
 *          - namespace: Define the metric namespace. Default: application
 */
Client.prototype.gauge = function (name, value, parameters) {
    putMetricType(this, this.default.gauge, 'gauge.' + name, value, parameters);
};

/**
 * Adds a new metric to the in-memory buffer.
 *
 * @param metric Name metric such as 'response_time'
 * @param value
 * @param parameters An object with metric para meters: tags, agg, aggFreq and namespace
 *          - tags: Tags to associate this value with, for example {from: 'serviceA', to: 'serviceB', method: 'login'}
 *          - agg: List of aggregations to be applied by the Statful. Ex: ['avg', 'p90', 'min']
 *          - aggFreq: Aggregation frequency in seconds. One of: 10, 15, 30, 60 or 300
 *          - namespace: Define the metric namespace. Default: application
 */
Client.prototype.put = function (metric, value, parameters) {
    var metricParams = parameters || {};

    var tags = metricParams.tags,
        agg = metricParams.agg,
        aggFreq = metricParams.aggFreq,
        sampleRate = metricParams.sampleRate,
        namespace = metricParams.namespace;

    if (!configHelper.areMetricTypesArgumentsValid(agg, aggFreq, tags)) {
        this.logger.warn('Metric not sent. Please review the following: aggregations, aggregation frequency and tags');
    } else {
        var putNamespace = namespace || this.namespace;
        var putAggFreq = aggFreq || 10;
        var putTags = merge(this.app ? merge({app: this.app}, tags) : tags, this.tags);

        var metricName = putNamespace + '.' + metric,
            flushLine = metricName,
            sampleRateNormalized = (sampleRate || 100) / 100;

        if (Math.random() <= sampleRateNormalized) {
            flushLine = Object.keys(putTags).reduce(function (previousValue, tag) {
                return previousValue + ',' + tag + '=' + putTags[tag];
            }, flushLine);

            flushLine += ' ' + value + ' ' + Math.round(new Date().getTime() / 1000);

            if (agg) {
                agg.push(putAggFreq);
                flushLine += ' ' + agg.join(',');

                if (sampleRate) {
                    flushLine += sampleRate ? ' ' + sampleRate : '';
                }
            }

            this.putRaw([flushLine]);
        }
    }
};

/**
 * Adds raw metrics directly into the flush buffer. Use this method with caution.
 *
 * @param metricLines
 */
Client.prototype.putRaw = function (metricLines) {

    if (typeof metricLines !== 'undefined') {
        if (this.bufferSize > 0) {
            this.buffer += '\n';
        }

        this.buffer += metricLines;
        this.bufferSize++;

        if (this.bufferSize >= this.flushSize) {
            this.flush();
        }
    } else {
        if (this.logger) {
            this.logger.error('Invalid metric lines: ' + metricLines);
        }
    }
};

/**
 * Execute the request using the specified options.
 *
 * @param options The options to use in the request
 * @param logger A logger instance
 * @returns {*|exports}
 */
function performRequest(options, logger) {
    return request(options, function callback(error, response) {
        if (logger) {
            if (error) {
                logger.error('An error occurred: ' + error);
            }

            if (response && response.statusCode !== 201) {
                logger.error('Unexpected status: ' + response.statusCode);
            }
        }
    });
}

/**
 * Creates a stream from a string.
 *
 * @param string The string to transform to stream
 * @returns {*} A pipeable stream
 */
function getGzipStreamFromString(string) {
    var messageStream = new Readable();
    messageStream.push(string);
    messageStream.push(null);

    return messageStream
        .pipe(zlib.createGzip());
}

/**
 * Sends the specified message using compression.
 *
 * @param options The options to use in the request
 * @param message The message to send in the request
 * @param logger A logger instance
 */
function sendCompressedMessage(options, message, logger) {
    options.headers['Content-Encoding'] = 'gzip';

    getGzipStreamFromString(message)
        .pipe(performRequest(options, logger));
}

/**
 * Sends the specified message without using any compression.
 *
 * @param options The options to use in the request
 * @param message The message to send in the request
 * @param logger A logger instance
 */
function sendUncompressedMessage(options, message, logger) {
    options.body = message;

    performRequest(options, logger);
}

/**
 * Builds a default options object to use for remote HTTP requests.
 *
 * @param protocol The protocol to use
 * @param host The host to send
 * @param port The port on the host
 * @param path The path to send
 * @param token A Statful token object for authentication
 * @param timeout A request timeout
 * @returns {*} An options object
 */
function buildStatfulOptions(protocol, host, port, path, token, timeout) {
    return {
        url: protocol + '://' + host + ':' + port + path,
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Telemetry-client-nodejs ',
            'M-Api-Token': token
        },
        timeout: timeout
    };
}

/**
 * Flushes the metrics to the Statful via UDP.
 */
Client.prototype.flush = function () {
    var buffer;

    if (this.bufferSize > 0) {
        var sizeToFlush = this.bufferSize;

        if (this.dryRun) {
            if (this.logger) {
                this.logger.debug('Flushing metrics: ' + this.buffer);
            }
        } else {
            switch (this.transport) {
                case 'udp':
                    if (this.logger) {
                        this.logger.debug('Flushing to ' + this.host + ', UDP port: ' + this.port);
                    }
                    buffer = new Buffer(this.buffer);
                    this.socket.send(buffer, 0, buffer.length, this.port, this.host);
                    break;
                case 'http':
                    if (this.logger) {
                        this.logger.debug('Flushing to ' + this.host + this.path + ', port: ' + this.port);
                    }
                    var options = buildStatfulOptions(
                        this.protocol, this.host, this.port, this.path, this.token, this.timeout);

                    if (this.compression) {
                        sendCompressedMessage(options, this.buffer, this.logger);
                    } else {
                        sendUncompressedMessage(options, this.buffer, this.logger);
                    }
                    break;
            }
        }
        this.buffer = '';
        this.bufferSize = 0;

        if (this.systemStats) {
            this.put('buffer.flush_length', sizeToFlush, {agg: ['avg']});
        }
    }
};

/**
 * Close the underlying socket and stop listening for data on it.
 */
Client.prototype.close = function () {
    this.socket.close();
};

module.exports = Client;
