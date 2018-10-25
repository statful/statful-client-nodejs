'use strict';

var dgram = require('dgram');

var merge = require('merge');
var configHelper = require('./config-helper');
var transport = require('./transport');
var Logger = require('./logger');

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
function putMetric (self, metricTypeConf, name, value, aggregation, aggregationFreq, parameters) {
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
            putAggFreq = metricTypeConf ? aggFreq || metricTypeConf.aggFreq : aggFreq;

        putRaw(
            self,
            name,
            value,
            {
                tags: putTags,
                agg: putAgg,
                aggFreq: putAggFreq,
                namespace: namespace,
                timestamp: timestamp,
                sampleRate: sampleRate
            },
            isMetricAggregated
        );
    } else {
        self.logger.debug(
            'Metric not sent. Please review the following: aggregations, aggregation frequency, tags and timestamp.'
        );
    }
}

/**
 * Logs all the metrics to the logger
 *
 * @param self A self client instance.
 */
function logMetrics (self) {
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
                        stringToLog += '\n';
                    }
                    stringToLog += self.aggregatedBuffer[aggLog][aggFreqLog].buffer;
                    self.aggregatedBuffer[aggLog][aggFreqLog].buffer = '';
                }
            }
        }
        self.logger.debug(stringToLogHeader + stringToLog);
    }
    if (pluginsBuffersSize(self.pluginBuffers) > 0) {
        self.logger.debug('Flushing plugins metrics');
    }
}

function pluginsBuffersSize (buffers) {
    var size = 0;

    for (var i in buffers) {
        size += buffers[i].bufferSize;
    }

    return size;
}

/**
 * Sends the non aggregated and system stats metrics using UDP transport
 *
 * @param self A self client instance.
 */
function sendMetricsByUdpTransport (self) {
    var buffer;

    self.logger.debug('Flushing to ' + self.host + ', UDP port: ' + self.port);

    if (self.aggregatedBuffer.bufferSize > 0) {
        self.logger.debug("Can't flush aggregated metrics using udp transport.");

        self.aggregatedBuffer = configHelper.createEmptyAggregatedBuffer();
    }

    if (self.nonAggregatedBuffer.bufferSize > 0) {
        buffer = new Buffer(self.nonAggregatedBuffer.buffer);
        self.socket.send(buffer, 0, buffer.length, self.port, self.host);
    }

    for (var i in self.pluginBuffers) {
        buffer = new Buffer(self.pluginBuffers[i].buffer);
        self.socket.send(buffer, 0, buffer.length, self.port, self.host);
    }
}

/**
 * Sends all metrics using API transport
 *
 * @param self A self client instance.
 */
function sendMetricsByApiTransport (self) {
    var agg;
    var aggFreq;

    if (self.nonAggregatedBuffer.bufferSize > 0) {
        var nonAggregatedOptions = transport.buildRequestOptions(
            self.protocol,
            self.host,
            self.port,
            self.basePath,
            self.token,
            self.timeout
        );

        self.logger.debug('Flushing to ' + nonAggregatedOptions.url + ' non aggregated metrics');

        if (self.compression) {
            transport.sendCompressedMessage(nonAggregatedOptions, self.nonAggregatedBuffer.buffer, self.logger);
        } else {
            transport.sendUncompressedMessage(nonAggregatedOptions, self.nonAggregatedBuffer.buffer, self.logger);
        }
    }

    if (self.aggregatedBuffer.bufferSize > 0) {
        for (agg in self.aggregatedBuffer) {
            for (aggFreq in self.aggregatedBuffer[agg]) {
                if (self.aggregatedBuffer[agg][aggFreq].buffer.length > 0) {
                    var aggregatedPath = self.basePath + '/aggregation/' + agg + '/frequency/' + aggFreq;
                    var aggregatedOptions = transport.buildRequestOptions(
                        self.protocol,
                        self.host,
                        self.port,
                        aggregatedPath,
                        self.token,
                        self.timeout
                    );

                    self.logger.debug('Flushing to ' + aggregatedOptions.url + ' aggregated metrics');

                    if (self.compression) {
                        transport.sendCompressedMessage(
                            aggregatedOptions,
                            self.aggregatedBuffer[agg][aggFreq].buffer,
                            self.logger
                        );
                    } else {
                        transport.sendUncompressedMessage(
                            aggregatedOptions,
                            self.aggregatedBuffer[agg][aggFreq].buffer,
                            self.logger
                        );
                    }
                    self.aggregatedBuffer[agg][aggFreq].buffer = '';
                }
            }
        }
    }

    for (var i in self.pluginBuffers) {
        var element = self.pluginBuffers[i];
        if(element.bufferSize > 0) {
            var nonAggregatedStatsOptions = transport.buildRequestOptions(
                self.protocol,
                self.host,
                self.port,
                self.basePath,
                self.token,
                self.timeout
            );

            self.logger.debug('Flushing to ' + nonAggregatedStatsOptions.url + ' system stats metrics');

            if (self.compression) {
                transport.sendCompressedMessage(nonAggregatedStatsOptions, element.buffer, self.logger);
            } else {
                transport.sendUncompressedMessage(nonAggregatedStatsOptions, element.buffer, self.logger);
            }
        }
    }
}

/**
 * Flushes the metrics to the Statful via UDP.
 *
 * @param self A self client instance.
 */
function flush (self) {
    for (var index = 0; index < self.plugins.length; index++) {
        self.plugins[index].onFlush(self);
    }

    var metricsCounter =
        self.aggregatedBuffer.bufferSize + self.nonAggregatedBuffer.bufferSize + pluginsBuffersSize(self.pluginBuffers);

    if (metricsCounter > 0) {
        if (self.dryRun) {
            logMetrics(self);
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

        for (var i in self.pluginBuffers) {
            self.pluginBuffers[i].buffer = '';
            self.pluginBuffers[i].bufferSize = 0;
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
function addToBuffer (self, metricLines, isMetricAggregated, agg, aggFreq) {
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

        if (
            self.aggregatedBuffer.bufferSize +
                self.nonAggregatedBuffer.bufferSize +
                pluginsBuffersSize(self.pluginBuffers) >=
            self.flushSize
        ) {
            setTimeout(function () {
                flush(self);
            }, 0);
        }
    } else {
        self.logger.error('addToBuffer: Invalid metric lines: ' + metricLines);
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
function putRaw (self, metric, value, parameters, isMetricAggregated) {
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
    var putTags = merge(self.app ? merge({ app: self.app }, tags) : tags, self.tags);

    var metricName = putNamespace + '.' + metric,
        flushLine = metricName,
        sampleRateNormalized = (sampleRate || 100) / 100;

    if (Math.random() <= sampleRateNormalized || isMetricAggregated) {
        flushLine = Object.keys(putTags).reduce(function (previousValue, tag) {
            return previousValue + ',' + tag + '=' + putTags[tag];
        }, flushLine);

        flushLine += ' ' + value + ' ' + (timestamp || Math.round(new Date().getTime() / 1000));

        if (agg && !isMetricAggregated) {
            agg.push(putAggFreq);
            flushLine += ' ' + agg.join(',');

            if (sampleRate && sampleRate < 100) {
                flushLine += ' ' + sampleRate;
            }
        }

        if (!isMetricAggregated) {
            addToBuffer(self, [flushLine], isMetricAggregated, null, null);
        } else {
            addToBuffer(self, [flushLine], isMetricAggregated, agg[0], putAggFreq);
        }
    } else {
        self.logger.debug('Metric was discarded due to sample rate.');
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
function putAggregatedMetric (self, metricTypeConf, name, value, agg, aggFreq, parameters) {
    putMetric(self, metricTypeConf, name, value, agg, aggFreq, parameters);
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
function putNonAggregatedMetric (self, metricTypeConf, name, value, parameters) {
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
    this.logger = new Logger(logger);

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
            this.protocol = config.api.protocol || 'https';
            this.basePath = config.api.path || config.path || '/tel/v2.0/metrics';
            this.timeout = config.api.timeout || 2000;
            this.token = config.token || config.api.token;
            break;
    }

    this.app = config.app;
    this.namespace = config.namespace || 'application';
    this.dryRun = config.dryRun;
    this.tags = config.tags || {};
    this.sampleRate = config.sampleRate || 100;
    this.flushInterval = config.flushInterval || 3000;
    this.flushSize = config.flushSize || 1000;
    this.compression = config.compression || false;

    this.default = {};
    this.default.timer = {
        agg: ['avg', 'p90', 'count'],
        tags: { unit: 'ms' }
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

    this.plugins = [];
    this.pluginBuffers = {};

    setInterval(
        function (obj) {
            flush(obj);
        },
        this.flushInterval,
        this
    );
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
    flush(this);
    this.socket.close();
};

/**
 * Flush the metrics buffer.
 */
Client.prototype.flush = function () {
    flush(this);
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

Client.prototype.use = function (plugin) {
    plugin.onInit(this);
    this.plugins.push(plugin);
};

module.exports = Client;
