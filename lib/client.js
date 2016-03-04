/* jshint shadow:true, bitwise:false */
var dgram = require('dgram'),
    blocked = require('blocked'),
    request = require('request'),
    merge = require('merge'),
    zlib = require('zlib'),
    Readable = require('stream').Readable;

/**
 * The UDP Client for Telemetron.
 *
 * @param config
 * @constructor
 */
var Client = function (config) {
    var self = this;

    config = config || {};

    this.transport = config.transport || 'udp';

    switch (this.transport) {
        case 'udp':
            this.host = (config.udp && config.udp.host) || config.host || '127.0.0.1';
            this.port = (config.udp && config.udp.port) || config.port || 2013;
            this.socket = dgram.createSocket('udp4');
            break;
        case 'api':
            if (!config.api || !config.api.token) {
                throw 'Telemetron API Token not defined';
            }
            this.host = config.api.host || 'api.telemetron.io';
            this.port = config.api.port || 443;
            this.protocol = config.api.protocol || 'https';
            this.path = config.api.path || '/tel/v2.0/metrics';
            this.timeout = config.api.timeout || 2000;
            this.token = config.api.token;
            break;
    }

    this.prefix = config.prefix;
    this.app = config.app;
    this.mock = config.mock;
    this.tags = config.tags || {};
    this.systemStats = (config.systemStats !== undefined) ? config.systemStats : true;
    this.autoDiagnostics = (config.autoDiagnostics !== undefined) ? config.autoDiagnostics : true;
    this.sampleRate = config.sampleRate || false;
    this.flushInterval = config.flushInterval || 500;
    this.compression = config.compression || false;

    this.buffer = '';
    this.bufferSize = 0;

    if (this.systemStats && this.autoDiagnostics) {
        blocked(function (ms) {
            self.time('event_loop', ms);
        });
    }

    setInterval(function (obj) {
        obj.flush();
    }, config.flushInterval, this);

};

/**
 * Sends a timing metric
 *
 * @param name Name of the counter. Ex: response_time
 * @param value
 * @param tags Tags to associate this value with, for example {from: 'serviceA', to: 'serviceB', method: 'login'}
 * @param agg List of aggregations to be applied by the Telemetron. Ex: ['avg', 'p90', 'min']
 * @param aggFreq Aggregation frequency in seconds. One of: 10, 15, 30, 60 or 300
 * @param namespace Define the metric namespace. Default: application
 */
Client.prototype.time = function (name, value, tags, agg, aggFreq, namespace) {
    var agg = agg || ['avg', 'p90', 'count', 'count_ps'],
        tags = tags || {},
        aggFreq = aggFreq || 10;

    this.put('timer.' + name, merge({unit: 'ms'}, tags), value, agg, aggFreq, this.sampleRate, namespace);
};

/**
 * Increments a counter
 *
 * @param name Name of the counter. Ex: transactions
 * @param value
 * @param tags Tags to associate this value with, for example {type: 'purchase_order'}
 * @param agg List of aggregations to be applied by the Telemetron. Ex: ['avg', 'p90', 'min']
 * @param aggFreq Aggregation frequency in seconds. One of: 10, 15, 30, 60 or 300
 * @param namespace Define the metric namespace. Default: application
 */
Client.prototype.inc = function (name, value, tags, agg, aggFreq, namespace) {
    var agg = agg || ['sum', 'count', 'count_ps'],
        tags = tags || {},
        aggFreq = aggFreq || 10;

    this.put('counter.' + name, tags, value | 0, agg, aggFreq, this.sampleRate, namespace);
};

/**
 * Adds a Gauge
 * @param name Name of the Gauge. Ex: current_sessions
 * @param value
 * @param tags Tags to associate this value with, for example {page: 'overview'}
 * @param agg List of aggregations to be applied by the Telemetron. Ex: ['avg', 'p90', 'min']
 * @param aggFreq Aggregation frequency in seconds. One of: 10, 15, 30, 60 or 300
 * @param namespace Define the metric namespace. Default: application
 */
Client.prototype.gauge = function (name, value, tags, agg, aggFreq, namespace) {
    var agg = agg || ['last'],
        tags = tags || {},
        aggFreq = aggFreq || 10;

    this.put('gauge.' + name, tags, value, agg, aggFreq, this.sampleRate, namespace);
};

/**
 * Adds a new metric to the in-memory buffer.
 *
 * @param metric Name metric such as 'response_time'
 * @param tags Tags to associate this value with, for example {from: 'serviceA', to: 'serviceB', method: 'login'}
 * @param value
 * @param agg List of aggregations to be applied by the Telemetron. Ex: ['avg', 'p90', 'min']
 * @param aggFreq Aggregation frequency in seconds. One of: 10, 15, 30, 60 or 300
 * @param sample_rate Sampling rate (1-99)
 */
Client.prototype.put = function (metric, tags, value, agg, aggFreq, sample_rate, namespace) {
    var namespace = namespace || 'application',
        metricName = this.prefix + '.' + namespace + '.' + metric,
        flushLine = metricName,
        aggFreq = aggFreq || 10,
        sample_rate_normalized = (sample_rate || 100) / 100,
        tags = merge(this.app ? merge({app: this.app}, tags) : tags, this.tags);

    if (Math.random() <= sample_rate_normalized) {
        flushLine = Object.keys(tags).reduce(function (previousValue, tag) {
            return previousValue + ',' + tag + '=' + tags[tag];
        }, flushLine);

        flushLine += ' ' + value + ' ' + Math.round(new Date().getTime() / 1000);

        if (agg) {
            agg.push(aggFreq);
            flushLine += ' ' + agg.join(',');

            if (sample_rate) {
                flushLine += sample_rate ? ' ' + sample_rate : '';
            }
        }

        this.putRaw([flushLine]);
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
            this.buffer += '\n'
        }

        this.buffer += metricLines;
        this.bufferSize++;
    } else {
        console.error('Invalid metric lines: ' + metricLines);
    }
};

/**
 * Execute the request using the specified options.
 *
 * @param options The options to use in the request
 * @returns {*|exports}
 */
function performRequest(options) {
    return request(options, function callback(error, response) {
        if (error) {
            console.error("An error occurred: " + error);
        }

        if (response && response.statusCode !== 201) {
            console.error("Unexpected status: " + response.statusCode);
        }
    })
}

/**
 * Creates a stream from a string.
 *
 * @param string The string to transform to stream
 * @returns {*} A pipeable stream
 */
function getGzipStreamFromString(string) {
    var messageStream = new Readable;
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
 */
function sendCompressedMessage(options, message) {
    options.headers['Content-Encoding'] = 'gzip';

    getGzipStreamFromString(message)
        .pipe(performRequest(options));
}

/**
 * Sends the specified message without using any compression.
 *
 * @param options The options to use in the request
 * @param message The message to send in the request
 */
function sendUncompressedMessage(options, message) {
    options.body = message;

    performRequest(options)
}

/**
 * Builds a default options object to use for remote HTTP requests.
 *
 * @param protocol The protocol to use
 * @param host The host to send
 * @param port The port on the host
 * @param path The path to send
 * @param token A Telemetron token object for authentication
 * @param timeout A request timeout
 * @returns {*} An options object
 */
function buildTelemetronOptions(protocol, host, port, path, token, timeout) {
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
 * Flushes the metrics to the Telemetron via UDP.
 */
Client.prototype.flush = function () {
    var buffer;

    if (this.bufferSize > 0) {
        if (this.autoDiagnostics) {
            this.put('buffer.flush_length', {}, this.bufferSize, ['avg']);
        }

        if (this.mock) {
            console.log('Flushing metrics: ' + this.buffer);
        } else {
            switch (this.transport) {
                case 'udp':
                    console.log('Flushing to ' + this.host + ', UDP port: ' + this.port);
                    buffer = new Buffer(this.buffer);
                    this.socket.send(buffer, 0, buffer.length, this.port, this.host);
                    break;
                case 'api':
                    console.log('Flushing to ' + this.host + this.path + ', port: ' + this.port);
                    var options = buildTelemetronOptions(
                        this.protocol, this.host, this.port, this.path, this.token, this.timeout);

                    if (this.compression) {
                        sendCompressedMessage(options, this.buffer);
                    } else {
                        sendUncompressedMessage(options, this.buffer);
                    }
                    break;
            }
        }
        this.buffer = '';
        this.bufferSize = 0;
    }
};

/**
 * Close the underlying socket and stop listening for data on it.
 */
Client.prototype.close = function () {
    this.socket.close();
};

module.exports = Client;