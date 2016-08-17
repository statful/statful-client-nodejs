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
            this.host = config.api.host || 'api.statful.com';
            this.port = config.api.port || 443;
            this.secure = (config.api.secure !== undefined) ? config.api.secure : true;
            this.protocol = this.secure ? 'https' : 'http';
            // TODO - Path is to remove as soon as possible
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
    this.sampleRate = config.sampleRate || 100;
    this.flushInterval = config.flushInterval || 3000;
    this.flushSize = config.flushSize || 1000;
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

    this.aggregatedBuffer = configHelper.createEmptyAggregatedBuffer();

    this.nonAggregatedBuffer = {
        buffer: '',
        bufferSize: 0
    };

    if (this.systemStats) {
        blocked(function (ms) {
            self.timer('event_loop', ms);
        });
    }

    setInterval(function (obj) {
        obj.flush();
    }, config.flushInterval, this);

};

function putMetricType(self, metricTypeConf, name, value, aggregation, aggregationFreq, parameters) {
    var isMetricAggregated = aggregation && aggregationFreq;
    var metricParams = parameters || {};
    var tags = metricParams.tags,
        agg = !isMetricAggregated ? metricParams.agg : [aggregation],
        aggFreq = !isMetricAggregated ? metricParams.aggFreq : aggregationFreq,
        namespace = metricParams.namespace,
        timestamp = metricParams.timestamp;

    if (configHelper.areMetricTypesArgumentsValid(agg, aggFreq, tags)) {
        var putAgg = configHelper.concatAggregations(metricTypeConf.agg, agg),
            putTags = merge(tags, metricTypeConf.tags),
            putAggFreq = aggFreq || metricTypeConf.aggFreq;
        // TODO - add timestamp validation to areMetricTypesArgumentsValid

        self.put(name, value, {tags: putTags, agg: putAgg, aggFreq: putAggFreq, namespace: namespace, timestamp: timestamp}, isMetricAggregated);
    } else if (self.logger) {
        self.logger.warn('Metric not sent. Please review the following: aggregations, aggregation frequency and tags');
    }
}

function putAggregatedMetricType(self, metricTypeConf, name, value, agg, aggFreq, parameters) {
    putMetricType(self, metricTypeConf, name, value, agg, aggFreq, parameters);
}

function putNonAggregatedMetricType(self, metricTypeConf, name, value, parameters) {
    putMetricType(self, metricTypeConf, name, value, null, null, parameters);
}

Client.prototype.aggregatedTimer = function (name, timestamp, agg, aggFreq, parameters) {
    putAggregatedMetricType(this, this.default.timer, 'timer.' + name, timestamp, agg, aggFreq, parameters);
};

/**
 * Sends a timing metric
 *
 * @param name Name of the timer. Ex: response_time
 * @param timestamp Timestamp of the timing metric
 * @param parameters An object with metric para meters: tags, agg, aggFreq and namespace
 *          - tags: Tags to associate this value with, for example {from: 'serviceA', to: 'serviceB', method: 'login'}
 *          - agg: List of aggregations to be applied by Statful. Ex: ['avg', 'p90', 'min']
 *          - aggFreq: Aggregation frequency in seconds. One of: 10, 30, 60 ,120, 180, 300
 *          - namespace: Define the metric namespace. Default: application
 */
Client.prototype.timer = function (name, timestamp, parameters) {
    putNonAggregatedMetricType(this, this.default.timer, 'timer.' + name, timestamp, parameters);
};

Client.prototype.aggregatedCounter = function (name, value, agg, aggFreq, parameters) {
    putAggregatedMetricType(this, this.default.counter, 'counter.' + name, value, agg, aggFreq, parameters);
};

/**
 * Increments a counter
 *
 * @param name Name of the counter. Ex: transactions
 * @param value Value of the counter to increment/decrement
 * @param parameters An object with metric para meters: tags, agg, aggFreq and namespace
 *          - tags: Tags to associate this value with, for example {from: 'serviceA', to: 'serviceB', method: 'login'}
 *          - agg: List of aggregations to be applied by Statful. Ex: ['avg', 'p90', 'min']
 *          - aggFreq: Aggregation frequency in seconds. One of: 10, 30, 60 ,120, 180, 300
 *          - namespace: Define the metric namespace. Default: application
 */
Client.prototype.counter = function (name, value, parameters) {
    putNonAggregatedMetricType(this, this.default.counter, 'counter.' + name, value, parameters);
};

Client.prototype.aggregatedGauge = function (name, value, agg, aggFreq, parameters) {
    putAggregatedMetricType(this, this.default.gauge, 'gauge.' + name, value, agg, aggFreq, parameters);
};

/**
 * Adds a Gauge
 * @param name Name of the Gauge. Ex: current_sessions
 * @param value Value of the gauge
 * @param parameters An object with metric para meters: tags, agg, aggFreq and namespace
 *          - tags: Tags to associate this value with, for example {from: 'serviceA', to: 'serviceB', method: 'login'}
 *          - agg: List of aggregations to be applied by Statful. Ex: ['avg', 'p90', 'min']
 *          - aggFreq: Aggregation frequency in seconds. One of: 10, 30, 60 ,120, 180, 300
 *          - namespace: Define the metric namespace. Default: application
 */
Client.prototype.gauge = function (name, value, parameters) {
    putNonAggregatedMetricType(this, this.default.gauge, 'gauge.' + name, value, parameters);
};

/**
 * Adds a new metric to the in-memory buffer.
 *
 * @param metric Name metric such as 'response_time'
 * @param value
 * @param parameters An object with metric para meters: tags, agg, aggFreq and namespace
 *          - tags: Tags to associate this value with, for example {from: 'serviceA', to: 'serviceB', method: 'login'}
 *          - agg: List of aggregations to be applied by Statful. Ex: ['avg', 'p90', 'min']
 *          - aggFreq: Aggregation frequency in seconds. One of: 10, 30, 60 ,120, 180, 300
 *          - namespace: Define the metric namespace. Default: application
 * @param isMetricAggregated
 */
Client.prototype.put = function (metric, value, parameters, isMetricAggregated) {
    var metricParams = parameters || {};

    var tags = metricParams.tags,
        agg = metricParams.agg,
        aggFreq = metricParams.aggFreq,
        namespace = metricParams.namespace,
        timestamp = metricParams.timestamp,
        sampleRate = this.sampleRate;


    if (!configHelper.areMetricTypesArgumentsValid(agg, aggFreq, tags)) {
        this.logger.warn('Metric not sent. Please review the following: aggregations, aggregation frequency and tags');
    } else {
        var putNamespace = namespace || this.namespace;
        var putAggFreq = aggFreq || 10;
        var putTags = merge(this.app ? merge({app: this.app}, tags) : tags, this.tags);

        var metricName = putNamespace + '.' + metric,
            flushLine = metricName,
            sampleRateNormalized = (sampleRate || 100) / 100;

        if ( (Math.random() <= sampleRateNormalized) || isMetricAggregated) {
            flushLine = Object.keys(putTags).reduce(function (previousValue, tag) {
                return previousValue + ',' + tag + '=' + putTags[tag];
            }, flushLine);

            flushLine += ' ' + value + ' ' + (timestamp || (Math.round(new Date().getTime() / 1000)));

            if (agg && !isMetricAggregated) {
                agg.push(putAggFreq);
                flushLine += ' ' + agg.join(',');

                if (sampleRate && sampleRate < 100) {
                    flushLine += ' ' + sampleRate;
                }
            }

            if (!isMetricAggregated) {
                this.putRaw([flushLine], isMetricAggregated, null, null);
            } else {
                this.putRaw([flushLine], isMetricAggregated, agg[0], putAggFreq);
            }
        }
    }
};

/**
 * Adds raw metrics directly into the flush buffer. Use this method with caution.
 *
 * @param metricLines
 * @param isMetricAggregated
 */
Client.prototype.putRaw = function (metricLines, isMetricAggregated, agg, aggFreq) {

    if (typeof metricLines !== 'undefined') {
        var targetBuffer = isMetricAggregated ? this.aggregatedBuffer : this.nonAggregatedBuffer;

        if (isMetricAggregated) {
            if (targetBuffer[agg][aggFreq].length > 0) {
                targetBuffer[agg][aggFreq].buffer += '\n';
            }

            targetBuffer[agg][aggFreq].buffer += metricLines;
            targetBuffer.bufferSize++;
        } else {
            if (targetBuffer.bufferSize > 0) {
                targetBuffer.buffer += '\n';
            }

            targetBuffer.buffer += metricLines;
            targetBuffer.bufferSize++;
        }


        if ( (this.aggregatedBuffer.bufferSize + this.nonAggregatedBuffer.bufferSize) >= this.flushSize) {
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

    if ( (this.aggregatedBuffer.bufferSize + this.nonAggregatedBuffer.bufferSize) > 0) {
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

                    if (this.aggregatedBuffer.bufferSize > 0) {
                        if (this.logger) {
                            this.logger.debug('Can\'t flush aggregated metrics using udp transport.');
                        }
                        this.aggregatedBuffer = configHelper.createEmptyAggregatedBuffer();
                    }

                    if (this.nonAggregatedBuffer.bufferSize > 0) {
                        buffer = new Buffer(this.nonAggregatedBuffer.buffer);
                        this.socket.send(buffer, 0, buffer.length, this.port, this.host);
                    }
                    break;
                case 'http':
                    if (this.nonAggregatedBuffer.bufferSize > 0) {
                        var nonAggregatedOptions = buildStatfulOptions(
                            this.protocol, this.host, this.port, this.path, this.token, this.timeout);

                        if (this.logger) {
                            this.logger.debug('Flushing to ' + nonAggregatedOptions.url + ' non aggregated metrics');
                        }

                        if (this.compression) {
                            sendCompressedMessage(nonAggregatedOptions, this.nonAggregatedBuffer.buffer, this.logger);
                        } else {
                            sendUncompressedMessage(nonAggregatedOptions, this.nonAggregatedBuffer.buffer, this.logger);
                        }
                    }

                    if (this.aggregatedBuffer.bufferSize > 0) {
                        for (var agg in this.aggregatedBuffer) {
                            for (var aggFreq in this.aggregatedBuffe[agg]) {
                                if (this.aggregatedBuffer[agg][aggFreq].length > 0) {
                                    var aggregatedPath = '/tel/v2.0/metrics/aggregation/' + agg + '/freq/' + aggFreq;
                                    var aggregatedOptions = buildStatfulOptions(
                                        this.protocol, this.host, this.port, aggregatedPath, this.token, this.timeout);

                                    if (this.logger) {
                                        this.logger.debug('Flushing to ' + aggregatedOptions.url + ' aggregated metrics');
                                    }

                                    if (this.compression) {
                                        sendCompressedMessage(aggregatedOptions, this.aggregatedBuffer[agg][aggFreq].buffer, this.logger);
                                    } else {
                                        sendUncompressedMessage(aggregatedOptions, this.aggregatedBuffer[agg][aggFreq].buffer, this.logger);
                                    }
                                    this.aggregatedBuffer[agg][aggFreq].buffer = '';
                                }
                            }
                        }
                    }
                    break;
            }
        }

        if (this.systemStats) {
            if (this.aggregatedBuffer.bufferSize > 0 && this.transport === "http") {
                this.put('buffer_aggregated.flush_length', this.aggregatedBuffer.bufferSize, {agg: ['avg']}, false);
            }
            if (this.nonAggregatedBuffer.bufferSize > 0) {
                this.put('buffer.flush_length', this.nonAggregatedBuffer.bufferSize, {agg: ['avg']}, false);
            }
        }

        this.aggregatedBuffer.bufferSize = 0;
        this.nonAggregatedBuffer.buffer = '';
        this.nonAggregatedBuffer.bufferSize = 0;
    }
};

/**
 * Close the underlying socket and stop listening for data on it.
 */
Client.prototype.close = function () {
    this.socket.close();
};

module.exports = Client;
