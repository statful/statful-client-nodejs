/* jshint shadow:true, bitwise:false */
var dgram = require('dgram'),
    blocked = require('blocked'),
    //memwatch = require('memwatch'),
    merge = require('merge');
//,
//dns = require('dns');

/**
 * The UDP Client for Telemetron.
 *
 * @param config
 * @constructor
 */
var Client = function (config) {
    var self = this;

    this.host = config.host || '127.0.0.1';
    this.port = config.port || 2013;
    this.prefix = config.prefix;
    this.app = config.app;
    this.mock = config.mock;
    this.socket = dgram.createSocket('udp4');
    this.cacheDNS = config.cacheDNS || false;
    this.tags = config.tags || {};
    this.systemStats = config.systemStats || true;
    this.sampleRate = config.sampleRate || false;
    this.flushInterval = config.flushInterval || 20;
    this.buffer = [];

    //if (this.cacheDns === true) {
    //    dns.lookup(config.host, function (err, address /*, family*/) {
    //        if (err === null) {
    //            self.host = address;
    //        }
    //    });
    //}

    if (this.systemStats) {
        //memwatch.on('stats', function (s) {
        //    self.put('memory.num_full_gc', {}, s.num_full_gc, ['sum']);
        //    self.put('memory.num_inc_gc', {}, s.num_inc_gc, ['sum']);
        //    self.put('memory.heap_compactions', {}, s.heap_compactions, ['sum']);
        //    self.put('memory.estimated_base', {unit: 'byte'}, s.estimated_base, ['sum']);
        //    self.put('memory.current_base', {unit: 'byte'}, s.current_base, ['sum']);
        //    //self.put('memory.min', {unit: 'byte'}, s.min, ['min']);
        //    //self.put('memory.max', {unit: 'byte'}, s.max, ['max']);
        //    //self.put('memory.usage_trend', {}, s.usage_trend, ['avg']);
        //});

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

    this.put('timer.' + name, merge({unit: 'ms'}, tags), value | 0, agg, aggFreq, this.sampleRate, namespace);
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

    this.put('gauge.' + name, tags, value | 0, agg, aggFreq, this.sampleRate, namespace);
};

/**
 * Adds a new metric to the in-memory buffer.
 *
 * @param metric Name metric such as "response_time"
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
        tags = merge(merge({app: this.app}, tags), this.tags);

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
            buffer = new Buffer(message);
            this.socket.send(buffer, 0, buffer.length, this.port, this.host);
        }

        this.buffer = [];
    }
};


/**
 * Close the underlying socket and stop listening for data on it.
 */
Client.prototype.close = function () {
    this.socket.close();
};

module.exports = Client;