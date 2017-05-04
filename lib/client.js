'use strict';

//jshint latedef: nofunc

var dgram = require('dgram'),
    blocked = require('blocked'),
    https = require('https'),
    URL = require('url'),
    httpsAgent = new https.Agent({ maxSockets: 50, keepAlive: true }),
    merge = require('merge'),
    zlib = require('zlib'),
    Readable = require('stream').Readable,
    configHelper = require('./config-helper');

/**
 * Builds a default options object to use for remote HTTP requests.
 *
 * @param protocol The protocol to use.
 * @param host The host to send.
 * @param port The port on the host.
 * @param path The path to send.
 * @param token A Statful token object for authentication.
 * @param timeout A request timeout.
 *
 * @returns {*} An options object.
 */
function buildStatfulOptions(protocol, host, port, path, token, timeout) {
    return {
        url: protocol + '://' + host + ':' + port + path,
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'statful-client-nodejs ',
            'M-Api-Token': token
        },
        timeout: timeout
    };
}

/**
 * Creates a stream from a string.
 *
 * @param string The string to transform to stream.
 *
 * @returns {*} A pipeable stream.
 */
function getGzipStreamFromString(string) {
    var messageStream = new Readable();
    messageStream.push(string);
    messageStream.push(null);

    return messageStream
        .pipe(zlib.createGzip());
}

/**
 * Execute the request using the specified options.
 *
 * @param options The options to use in the request.
 * @param logger A logger instance.
 *
 * @returns {*|exports}
 */
function performRequest(options, logger) {
    var url = URL.parse(options.url);
    var req;

    options.agent = httpsAgent;
    options.hostname = url.hostname;
    options.port = url.port;
    options.path = url.path;

    req = https.request(options, function callback(res) {
        res.setEncoding('utf8');
    });

    req.on('error', function(e) {
        if (e.code === "ECONNRESET") {
            if (logger) {
                logger.error('A timeout occurred on a request to host: ' + options.hostname +
                    ' port: ' + options.port + ' and path: ' + options.path);
            }
        } else {
            if (logger) {
                logger.error('An error occurred: ' + e.message);
            }
        }
    });

    req.on('socket', function (socket) {
        socket.setTimeout(options.timeout);
        socket.on('timeout', function() {
            req.abort();
        });
    });

    // write data to request body and end the request if is an uncompressed request and has a body
    if (options.body) {
        req.write(options.body);
        req.end();
    }

    return req;
}

/**
 * Sends the specified message using compression.
 *
 * @param options The options to use in the request.
 * @param message The message to send in the request.
 * @param logger A logger instance.
 */
function sendCompressedMessage(options, message, logger) {
    options.headers['Content-Encoding'] = 'gzip';

    getGzipStreamFromString(message)
        .pipe(performRequest(options, logger));
}

/**
 * Sends the specified message without using any compression.
 *
 * @param options The options to use in the request.
 * @param message The message to send in the request.
 * @param logger A logger instance.
 */
function sendUncompressedMessage(options, message, logger) {
    options.body = message;

    performRequest(options, logger);
}

/**
 * Puts a metric into the buffer ready to be sent.
 *
 * @param self A self statful client.
 * @param metricTypeConf A configuration for each metric type (counter, gauge, timer). Can be null if it a custom metric.
 * @param name A metric name.
 * @param value A metric value.
 * @param aggregation The aggregation with which metric was aggregated.
 * @param aggregationFreq The aggregation frequency with which metric was aggregated.
 * @param parameters An object with metric para meters: tags, agg, aggFreq, namespace and timestamp.
 */
function putMetric(self, metricTypeConf, name, value, aggregation, aggregationFreq, parameters, isStats) {
    var isMetricAggregated = aggregation && aggregationFreq;
    var metricParams = parameters || {};
    var tags = metricParams.tags,
        agg = !isMetricAggregated ? metricParams.agg : [aggregation],
        aggFreq = !isMetricAggregated ? metricParams.aggFreq : aggregationFreq,
        namespace = metricParams.namespace,
        timestamp = metricParams.timestamp,
        sampleRate = metricParams.sampleRate;

    if (configHelper.areMetricTypesArgumentsValid(agg, aggFreq, tags, timestamp)) {
        var putAgg = metricTypeConf ? configHelper.concatAggregations(metricTypeConf.agg, agg) : agg,
            putTags = metricTypeConf ? merge(tags, metricTypeConf.tags) : tags,
            putAggFreq = metricTypeConf ? (aggFreq || metricTypeConf.aggFreq) : aggFreq;

        putRaw(self, name, value, {tags: putTags, agg: putAgg, aggFreq: putAggFreq, namespace: namespace, timestamp: timestamp, sampleRate: sampleRate}, isMetricAggregated, isStats);
    } else if (self.logger) {
        self.logger.warn('Metric not sent. Please review the following: aggregations, aggregation frequency, tags and timestamp.');
    }
}



function sendFlushStats(self) {
    if (self.systemStats) {
        if (self.aggregatedBuffer.bufferSize > 0 && self.transport === 'api') {
            putMetric(self, null, 'buffer.flush_length', self.aggregatedBuffer.bufferSize, null, null, {agg: ['avg'], tags: {"buffer_type": 'aggregated'}}, true);
        }
        if (self.nonAggregatedBuffer.bufferSize > 0) {
            putMetric(self, null, 'buffer.flush_length', self.nonAggregatedBuffer.bufferSize, null, null, {agg: ['avg'], tags: {"buffer_type": 'non-aggregated'}}, true);
        }
    }
}

/**
 * Logs all the metrics to the logger
 *
 * @param self A self client instance.

 */
function logMetrics(self) {
    var stringToLogHeader = '';
    var stringToLog = '';
    var aggLog;
    var aggFreqLog;

    if (self.nonAggregatedBuffer.bufferSize > 0) {
        self.logger.debug('Flushing metrics (non aggregated): ' + self.nonAggregatedBuffer.buffer);
    }
    if (self.aggregatedBuffer.bufferSize > 0) {
        stringToLogHeader = 'Flushing metrics (aggregated): ';

        for (aggLog in self.aggregatedBuffer) {
            for (aggFreqLog in self.aggregatedBuffer[aggLog]) {
                if (self.aggregatedBuffer[aggLog][aggFreqLog].buffer.length > 0) {
                    if (stringToLog.length > 0) {
                        stringToLog +='\n';
                    }
                    stringToLog += self.aggregatedBuffer[aggLog][aggFreqLog].buffer;
                    self.aggregatedBuffer[aggLog][aggFreqLog].buffer = '';
                }
            }
        }
        self.logger.debug(stringToLogHeader + stringToLog);
    }
    if (self.nonAggregatedStatsBuffer.bufferSize > 0) {
        self.logger.debug('Flushing metrics (non aggregated): ' + self.nonAggregatedStatsBuffer.buffer);
    }

    //in case we need to send aggregated stats metrics, add code here

}

/**
 * Logs all the metrics to the logger
 *
 * @param self A self client instance.

 */
function sendMetricsByUdpTransport(self) {
    var buffer;
    if (self.logger) {
        self.logger.debug('Flushing to ' + self.host + ', UDP port: ' + self.port);
    }

    if (self.aggregatedBuffer.bufferSize > 0) {
        if (self.logger) {
            self.logger.debug('Can\'t flush aggregated metrics using udp transport.');
        }
        self.aggregatedBuffer = configHelper.createEmptyAggregatedBuffer();
    }

    if (self.nonAggregatedBuffer.bufferSize > 0) {
        buffer = new Buffer(self.nonAggregatedBuffer.buffer);
        self.socket.send(buffer, 0, buffer.length, self.port, self.host);
    }

    //in case we need to send aggregated stats metrics, add code here

    if (self.nonAggregatedStatsBuffer.bufferSize > 0) {
        buffer = new Buffer(self.nonAggregatedStatsBuffer.buffer);
        self.socket.send(buffer, 0, buffer.length, self.port, self.host);
    }
}

/**
 * Logs all the metrics to the logger
 *
 * @param self A self client instance.

 */
function sendMetricsByApiTransport(self) {
    var agg;
    var aggFreq;

    if (self.nonAggregatedBuffer.bufferSize > 0) {
        var nonAggregatedOptions = buildStatfulOptions(
            self.protocol, self.host, self.port, self.basePath, self.token, self.timeout);

        if (self.logger) {
            self.logger.debug('Flushing to ' + nonAggregatedOptions.url + ' non aggregated metrics');
        }

        if (self.compression) {
            sendCompressedMessage(nonAggregatedOptions, self.nonAggregatedBuffer.buffer, self.logger);
        } else {
            sendUncompressedMessage(nonAggregatedOptions, self.nonAggregatedBuffer.buffer, self.logger);
        }
    }

    if (self.aggregatedBuffer.bufferSize > 0) {
        for (agg in self.aggregatedBuffer) {
            for (aggFreq in self.aggregatedBuffer[agg]) {
                if (self.aggregatedBuffer[agg][aggFreq].buffer.length > 0) {
                    var aggregatedPath = self.basePath + '/aggregation/' + agg + '/frequency/' + aggFreq;
                    var aggregatedOptions = buildStatfulOptions(
                        self.protocol, self.host, self.port, aggregatedPath, self.token, self.timeout);

                    if (self.logger) {
                        self.logger.debug('Flushing to ' + aggregatedOptions.url + ' aggregated metrics');
                    }

                    if (self.compression) {
                        sendCompressedMessage(aggregatedOptions, self.aggregatedBuffer[agg][aggFreq].buffer, self.logger);
                    } else {
                        sendUncompressedMessage(aggregatedOptions, self.aggregatedBuffer[agg][aggFreq].buffer, self.logger);
                    }
                    self.aggregatedBuffer[agg][aggFreq].buffer = '';
                }
            }
        }
    }

    if (self.nonAggregatedStatsBuffer.bufferSize > 0) {
        var nonAggregatedStatsOptions = buildStatfulOptions(
            self.protocol, self.host, self.port, self.basePath, self.token, self.timeout);

        if (self.logger) {
            self.logger.debug('Flushing to ' + nonAggregatedStatsOptions.url + ' non aggregated metrics');
        }

        if (self.compression) {
            sendCompressedMessage(nonAggregatedStatsOptions, self.nonAggregatedStatsBuffer.buffer, self.logger);
        } else {
            sendUncompressedMessage(nonAggregatedStatsOptions, self.nonAggregatedStatsBuffer.buffer, self.logger);
        }
    }

    //in case we need to send aggregated stats metrics, add code here
}

/**
 * Flushes the metrics to the Statful via UDP.
 *
 * @param self A self client instance.
 */
function flush(self) {

    sendFlushStats(self);

    if ( (self.aggregatedBuffer.bufferSize + self.nonAggregatedBuffer.bufferSize) > 0) {
        if (self.dryRun) {
            if (self.logger) {
                logMetrics(self);
            }
        } else {
            switch (self.transport) {
                case 'udp':
                    sendMetricsByUdpTransport(self);
                    break;
                case 'api':
                    sendMetricsByApiTransport(self);
                    break;
            }
        }

        self.aggregatedBuffer.bufferSize = 0;
        self.nonAggregatedBuffer.buffer = '';
        self.nonAggregatedBuffer.bufferSize = 0;
        self.nonAggregatedStatsBuffer.buffer = '';
        self.nonAggregatedStatsBuffer.bufferSize = 0;

    }
}

/**
 * Adds raw metrics directly into the flush buffer. Use this method with caution.
 *
 * @param self A self client instance.
 * @param metricLines The metrics, in valid line protocol, to push to the buffer.
 * @param isMetricAggregated A boolean state if metrics are aggregated.
 * @param agg In case that metric is aggregated we need to send the aggregation.
 * @param aggFreq In case that metric is aggregated we need to send the aggregation frequency.
 */
function addToBuffer(self, metricLines, isMetricAggregated, agg, aggFreq) {

    if (typeof metricLines !== 'undefined') {
        var targetBuffer = isMetricAggregated ? self.aggregatedBuffer : self.nonAggregatedBuffer;

        if (isMetricAggregated) {
            if (targetBuffer[agg][aggFreq].buffer.length > 0) {
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


        if ( (self.aggregatedBuffer.bufferSize + self.nonAggregatedBuffer.bufferSize) >= self.flushSize) {
            setTimeout(function() {
                flush(self);
            }, 0);
        }
    } else {
        if (self.logger) {
            self.logger.error('Invalid metric lines: ' + metricLines);
        }
    }
}

/**
 * Adds raw metrics directly into the flush buffer. Use this method with caution.
 *
 * @param self A self client instance.
 * @param metricLines The metrics, in valid line protocol, to push to the buffer.
 * @param isMetricAggregated A boolean state if metrics are aggregated.
 * @param agg In case that metric is aggregated we need to send the aggregation.
 * @param aggFreq In case that metric is aggregated we need to send the aggregation frequency.
 */
function addToStatsBuffer(self, metricLines, isMetricAggregated, agg, aggFreq) {

    if (typeof metricLines !== 'undefined') {
        var targetBuffer = isMetricAggregated ? self.aggregatedStatsBuffer : self.nonAggregatedStatsBuffer;

        if (isMetricAggregated) {
            if (targetBuffer[agg][aggFreq].buffer.length > 0) {
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

    } else {
        if (self.logger) {
            self.logger.error('Invalid metric lines: ' + metricLines);
        }
    }
}

/**
 * Adds a new metric to the in-memory buffer.
 *
 * @param self A self client instance.
 * @param metric Name metric such as 'response_time'.
 * @param value.
 * @param parameters An object with metric para meters: tags, agg, aggFreq, namespace and timestamp.
 *          - tags: Tags to associate this value with, for example {from: 'serviceA', to: 'serviceB', method: 'login'}.
 *          - agg: List of aggregations to be applied by Statful. Ex: ['avg', 'p90', 'min'].
 *          - aggFreq: Aggregation frequency in seconds. One of: 10, 30, 60 ,120, 180, 300. Default: 10.
 *          - namespace: Define the metric namespace. Default: application.
 *          - timestamp: Defines the metrics timestamp. Default: current timestamp.
 * @param isMetricAggregated
 */
function putRaw(self, metric, value, parameters, isMetricAggregated, isStats) {
    var metricParams = parameters || {};

    var tags = metricParams.tags,
        agg = metricParams.agg,
        aggFreq = metricParams.aggFreq,
        namespace = metricParams.namespace,
        timestamp = metricParams.timestamp,
        sampleRate = parameters.sampleRate || self.sampleRate;

    // Vars to Put
    var putNamespace = namespace || self.namespace;
    var putAggFreq = aggFreq || 10;
    var putTags = merge(self.app ? merge({app: self.app}, tags) : tags, self.tags);

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
            if (!isStats) {
                addToBuffer(self, [flushLine], isMetricAggregated, null, null);
            } else {
                addToStatsBuffer(self, [flushLine], isMetricAggregated, null, null);
            }
        } else {
            if (!isStats) {
                addToBuffer(self, [flushLine], isMetricAggregated, agg[0], putAggFreq);
            } else {
                addToStatsBuffer(self, [flushLine], isMetricAggregated, agg[0], putAggFreq);
            }
        }
    } else {
        if (self.logger) {
            self.logger.warn('Metric was discarded due to sample rate.');
        }
    }

}

/**
 * Calls put metric with an aggregated metric.
 *
 * @param self A self statful client.
 * @param metricTypeConf A configuration for each metric type (counter, gauge, timer). Can be null if it a custom metric.
 * @param name A metric name.
 * @param value A metric value.
 * @param agg The aggregation with which metric was aggregated.
 * @param aggFreq The aggregation frequency with which metric was aggregated.
 * @param parameters An object with metric para meters: tags, agg, aggFreq, namespace and timestamp.
 */
function putAggregatedMetric(self, metricTypeConf, name, value, agg, aggFreq, parameters) {
    putMetric(self, metricTypeConf, name, value, agg, aggFreq, parameters, false);
}

/**
 * Calls put metric with a non aggregated metric.
 *
 * @param self A self statful client.
 * @param metricTypeConf A configuration for each metric type (counter, gauge, timer). Can be null if it a custom metric.
 * @param name A metric name.
 * @param value A metric value.
 * @param parameters An object with metric para meters: tags, agg, aggFreq, namespace and timestamp.
 */
function putNonAggregatedMetric(self, metricTypeConf, name, value, parameters) {
    putMetric(self, metricTypeConf, name, value, null, null, parameters, false);
}

/**
 * The Client for Statful.
 *
 * @constructor Build a Statful client.
 *
 * @param config Client configuration object.
 * @param logger A logger instance.
 *
 * @returns A Statful client.
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
        case 'api':
            if (!config.api || !config.api.token) {
                throw 'Statful API Token not defined';
            }
            this.host = config.api.host || 'api.statful.com';
            this.port = config.api.port || 443;
            this.protocol = 'https';
            this.basePath = '/tel/v2.0/metrics';
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

    this.nonAggregatedStatsBuffer = {
        buffer: '',
        bufferSize: 0
    };

    if (this.systemStats) {
        blocked(function (ms) {
            self.timer('event_loop', ms);
        });
    }

    setInterval(function (obj) {
        flush(obj);
    }, this.flushInterval, this);

};

/**
 * Increments an aggregated counter
 *
 * @param name Name of the counter. Ex: transactions.
 * @param value Value of the counter to increment/decrement.
 * @param agg The aggregation with which metric was aggregated.
 * @param aggFreq The aggregation frequency with which metric was aggregated.
 * @param parameters An object with metric para meters: tags, agg, aggFreq, namespace and timestamp.
 *          - tags: Tags to associate this value with, for example {from: 'serviceA', to: 'serviceB', method: 'login'}. Default: {}.
 *          - agg: List of aggregations to be applied by Statful. Ex: ['avg', 'p90', 'min']. Default: ['avg', 'p90'].
 *          - aggFreq: Aggregation frequency in seconds. One of: 10, 30, 60 ,120, 180, 300. Default: 10.
 *          - namespace: Define the metric namespace. Default: application.
 *          - timestamp: Defines the metrics timestamp. Default: current timestamp.
 */
Client.prototype.aggregatedCounter = function (name, value, agg, aggFreq, parameters) {
    putAggregatedMetric(this, this.default.counter, 'counter.' + name, value, agg, aggFreq, parameters);
};

/**
 * Adds an aggregated Gauge.
 * @param name Name of the Gauge. Ex: current_sessions.
 * @param value Value of the gauge.
 * @param agg The aggregation with which metric was aggregated.
 * @param aggFreq The aggregation frequency with which metric was aggregated.
 * @param parameters An object with metric para meters: tags, agg, aggFreq, namespace and timestamp.
 *          - tags: Tags to associate this value with, for example {from: 'serviceA', to: 'serviceB', method: 'login'}. Default: {}.
 *          - agg: List of aggregations to be applied by Statful. Ex: ['avg', 'p90', 'min']. Default: ['last'].
 *          - aggFreq: Aggregation frequency in seconds. One of: 10, 30, 60 ,120, 180, 300. Default: 10.
 *          - namespace: Define the metric namespace. Default: application.
 *          - timestamp: Defines the metrics timestamp. Default: current timestamp.
 */
Client.prototype.aggregatedGauge = function (name, value, agg, aggFreq, parameters) {
    putAggregatedMetric(this, this.default.gauge, 'gauge.' + name, value, agg, aggFreq, parameters);
};

/**
 * Adds a new aggregated custom Metric.
 *
 * @param name Name of the Metric. Ex: response_time.
 * @param value Value of the Metric.
 * @param agg The aggregation with which metric was aggregated.
 * @param aggFreq The aggregation frequency with which metric was aggregated.
 * @param parameters An object with metric para meters: tags, agg, aggFreq, namespace and timestamp.
 *          - tags: Tags to associate this value with, for example {from: 'serviceA', to: 'serviceB', method: 'login'}. Default: {}.
 *          - agg: List of aggregations to be applied by Statful. Ex: ['avg', 'p90', 'min']. Default: [].
 *          - aggFreq: Aggregation frequency in seconds. One of: 10, 30, 60 ,120, 180, 300. Default: 10.
 *          - namespace: Define the metric namespace. Default: application.
 *          - timestamp: Defines the metrics timestamp. Default: current timestamp.
 */
Client.prototype.aggregatedPut = function (name, value, agg, aggFreq, parameters) {
    putAggregatedMetric(this, null, name, value, agg, aggFreq, parameters);
};

Client.prototype.aggregatedPutRaw = function (metricLine, agg, aggFreq) {
    addToBuffer(this, [metricLine], true, agg, aggFreq);
};

/**
 * Sends an aggregated timing metric
 *
 * @param name Name of the timer. Ex: response_time.
 * @param value Value of the timer.
 * @param agg The aggregation with which metric was aggregated.
 * @param aggFreq The aggregation frequency with which metric was aggregated.
 * @param parameters An object with metric para meters: tags, agg, aggFreq, namespace and timestamp.
 *          - tags: Tags to associate this value with, for example {from: 'serviceA', to: 'serviceB', method: 'login'}.
 *          - agg: List of aggregations to be applied by Statful. Ex: ['avg', 'p90', 'min']. Default: ['avg', 'p90', 'count'].
 *          - aggFreq: Aggregation frequency in seconds. One of: 10, 30, 60 ,120, 180, 300. Default: 10.
 *          - namespace: Define the metric namespace. Default: application.
 *          - timestamp: Defines the metrics timestamp. Default: current timestamp.
 */
Client.prototype.aggregatedTimer = function (name, value, agg, aggFreq, parameters) {
    putAggregatedMetric(this, this.default.timer, 'timer.' + name, value, agg, aggFreq, parameters);
};

/**
 * Close the underlying socket and stop listening for data on it.
 */
Client.prototype.close = function () {
    this.socket.close();
};

/**
 * Increments a counter
 *
 * @param name Name of the counter. Ex: transactions.
 * @param value Value of the counter to increment/decrement.
 * @param parameters An object with metric para meters: tags, agg, aggFreq, namespace and timestamp.
 *          - tags: Tags to associate this value with, for example {from: 'serviceA', to: 'serviceB', method: 'login'}. Default: {}.
 *          - agg: List of aggregations to be applied by Statful. Ex: ['avg', 'p90', 'min']. Default: ['avg', 'p90'].
 *          - aggFreq: Aggregation frequency in seconds. One of: 10, 30, 60 ,120, 180, 300. Default: 10.
 *          - namespace: Define the metric namespace. Default: application.
 *          - timestamp: Defines the metrics timestamp. Default: current timestamp.
 */
Client.prototype.counter = function (name, value, parameters) {
    putNonAggregatedMetric(this, this.default.counter, 'counter.' + name, value, parameters);
};

/**
 * Adds a Gauge.
 * @param name Name of the Gauge. Ex: current_sessions.
 * @param value Value of the gauge.
 * @param parameters An object with metric para meters: tags, agg, aggFreq, namespace and timestamp.
 *          - tags: Tags to associate this value with, for example {from: 'serviceA', to: 'serviceB', method: 'login'}. Default: {}.
 *          - agg: List of aggregations to be applied by Statful. Ex: ['avg', 'p90', 'min']. Default: ['last'].
 *          - aggFreq: Aggregation frequency in seconds. One of: 10, 30, 60 ,120, 180, 300. Default: 10.
 *          - namespace: Define the metric namespace. Default: application.
 *          - timestamp: Defines the metrics timestamp. Default: current timestamp.
 */
Client.prototype.gauge = function (name, value, parameters) {
    putNonAggregatedMetric(this, this.default.gauge, 'gauge.' + name, value, parameters);
};


/**
 * Adds a new custom Metric.
 *
 * @param name Name of the Metric. Ex: response_time.
 * @param value Value of the Metric.
 * @param parameters An object with metric para meters: tags, agg, aggFreq, namespace and timestamp.
 *          - tags: Tags to associate this value with, for example {from: 'serviceA', to: 'serviceB', method: 'login'}. Default: {}.
 *          - agg: List of aggregations to be applied by Statful. Ex: ['avg', 'p90', 'min']. Default: [].
 *          - aggFreq: Aggregation frequency in seconds. One of: 10, 30, 60 ,120, 180, 300. Default: 10.
 *          - namespace: Define the metric namespace. Default: application.
 *          - timestamp: Defines the metrics timestamp. Default: current timestamp.
 */
Client.prototype.put = function (name, value, parameters) {
    putNonAggregatedMetric(this, null, name, value, parameters);
};

Client.prototype.putRaw = function (metricLine) {
    addToBuffer(this, [metricLine], false, null, null);
};

/**
 * Sends a timing metric
 *
 * @param name Name of the timer. Ex: response_time.
 * @param value Value of the timer.
 * @param parameters An object with metric para meters: tags, agg, aggFreq, namespace and timestamp.
 *          - tags: Tags to associate this value with, for example {from: 'serviceA', to: 'serviceB', method: 'login'}. Default: {}.
 *          - agg: List of aggregations to be applied by Statful. Ex: ['avg', 'p90', 'min']. Default: ['avg', 'p90', 'count'].
 *          - aggFreq: Aggregation frequency in seconds. One of: 10, 30, 60 ,120, 180, 300. Default: 10.
 *          - namespace: Define the metric namespace. Default: application.
 *          - timestamp: Defines the metrics timestamp. Default: current timestamp.
 */
Client.prototype.timer = function (name, value, parameters) {
    putNonAggregatedMetric(this, this.default.timer, 'timer.' + name, value, parameters);
};

module.exports = Client;
