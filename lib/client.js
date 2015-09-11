var dgram = require('dgram'),
    blocked = require('blocked'),
    memwatch = require('memwatch'),
    merge = require('merge'),
    dns = require('dns');

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

    if (this.cacheDns === true) {
        dns.lookup(config.host, function (err, address /*, family*/) {
            if (err == null) {
                self.host = address;
            }
        });
    }

    if (this.systemStats) {
        memwatch.on('stats', function (s) {
            self.put('memory', {type: 'num_full_gc'}, s.num_full_gc, ['sum']);
            self.put('memory', {type: 'num_inc_gc'}, s.num_inc_gc, ['sum']);
            self.put('memory', {type: 'heap_compactions'}, s.heap_compactions, ['sum']);
            self.put('memory', {type: 'heap_compactions'}, s.heap_compactions, ['sum']);
            self.put('memory', {type: 'estimated_base', unit: 'byte'}, s.estimated_base, ['sum']);
            self.put('memory', {type: 'current_base', unit: 'byte'}, s.current_base, ['sum']);
        });

        blocked(function (ms) {
            self.time('event_loop', ms);
        });
    }

    setInterval(function (obj) {
        obj.flush();
    }, config.flushInterval, this);

};

Client.prototype.time = function (name, ms, tags, agg, aggFreq) {
    var agg = agg || ['avg', 'p90', 'max'],
        tags = tags || {},
        aggFreq = aggFreq || 10;

    this.put('timer', merge({type: name, unit: 'ms'}, tags), ms | 0, agg, aggFreq, this.sampleRate);
};

Client.prototype.put = function (metric, tags, value, agg, aggFreq, sample_rate) {
    var metricName = this.prefix + '.application.' + metric,
        flushLine = metricName,
        aggFreq = aggFreq || 10,
        tags = merge(this.tags, merge({app: this.app}, tags));

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

    this.buffer.push(flushLine);
};


Client.prototype.flush = function () {
    var message = this.buffer.join('\n'),
        buffer;

    if (message) {
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