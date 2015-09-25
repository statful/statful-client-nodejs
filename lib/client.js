/* jshint shadow:true, bitwise:false */
var dgram = require('dgram'),
    blocked = require('blocked'),
    request = require('request'),
    merge = require('merge');

/**
 * The UDP Client for Telemetron.
 *
 * @param config
 * @constructor
 */
var Client = function (config) {
    var self = this;

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
    this.sampleRate = config.sampleRate || false;
    this.flushInterval = config.flushInterval || 500;
    this.buffer = [];

    if (this.systemStats) {
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
    this.buffer = this.buffer.concat(metricLines);
};

/**
 * Flushes the metrics to the Telemetron via UDP.
 */
Client.prototype.flush = function () {
    var message,
        buffer;

    if (this.buffer.length > 0) {
        this.put('buffer.flush_length', {}, this.buffer.length, ['avg']);
        message = this.buffer.join('\n');

        if (this.mock) {
            console.log('Flushing metrics: ' + message);
        } else {
            switch (this.transport) {
                case 'udp':
                    buffer = new Buffer(message);
                    this.socket.send(buffer, 0, buffer.length, this.port, this.host);
                    break;
                case 'api':
                    var options = {
                        url: this.protocol + '://' + this.host + ':' + this.port + this.path,
                        method: 'PUT',
                        headers: {
                            'User-Agent': 'Telemetry-client-nodejs ',
                            'M-Api-Token': this.token
                        },
                        timeout: this.timeout,
                        multipart: [{
                            body: message
                        }]
                    };

                    request(options, function callback(error, response, body) {
                        if (error || response.statusCode !== 201) {
                            console.error(error);
                            console.error(body);
                        }
                    });

                    break;
            }
            this.buffer = [];
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