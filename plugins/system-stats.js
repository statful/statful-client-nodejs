var os = require('os');
var merge = require('merge');
var blocked = require('blocked');

/**
 * Puts a system stats metric into the system stats buffer ready to be sent.
 *
 * @param self A self statful client.
 * @param metricTypeConf A configuration for each metric type (counter, gauge, timer). Can be null if it a custom metric.
 * @param name A metric name.
 * @param value A metric value.
 * @param aggregation The aggregation with which metric was aggregated.
 * @param aggregationFreq The aggregation frequency with which metric was aggregated.
 * @param parameters An object with metric para meters: tags, agg, aggFreq, namespace and timestamp.
 */
function putSystemStatsMetrics (self, name, value, parameters) {
    var metricParams = parameters || {};
    var tags = metricParams.tags,
        agg = metricParams.agg,
        aggFreq = metricParams.aggFreq,
        namespace = metricParams.namespace,
        timestamp = metricParams.timestamp,
        sampleRate = metricParams.sampleRate;

    putSystemStats(self, name, value, {
        tags: tags,
        agg: agg,
        aggFreq: aggFreq,
        namespace: namespace,
        timestamp: timestamp,
        sampleRate: sampleRate
    });
}

/**
 * Adds a new system stats metric to the in-memory system stats buffer.
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
 */
function putSystemStats (self, metric, value, parameters) {
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

    if (Math.random() <= sampleRateNormalized) {
        flushLine = Object.keys(putTags).reduce(function (previousValue, tag) {
            return previousValue + ',' + tag + '=' + putTags[tag];
        }, flushLine);

        flushLine += ' ' + value + ' ' + (timestamp || Math.round(new Date().getTime() / 1000));

        if (agg) {
            agg.push(putAggFreq);
            flushLine += ' ' + agg.join(',');

            if (sampleRate && sampleRate < 100) {
                flushLine += ' ' + sampleRate;
            }
        }

        addToStatsBuffer(self, [flushLine]);
    } else {
        self.logger.debug('Metric was discarded due to sample rate.');
    }
}

/**
 * Adds raw metrics directly into the flush buffer. Use this method with caution.
 *
 * @param self A self client instance.
 * @param metricLines The metrics, in valid line protocol, to push to the buffer.
 */
function addToStatsBuffer (self, metricLines) {
    if (typeof metricLines !== 'undefined') {
        var targetBuffer = self.pluginBuffers.systemStats;

        if (targetBuffer.bufferSize > 0) {
            targetBuffer.buffer += '\n';
        }

        targetBuffer.buffer += metricLines;
        targetBuffer.bufferSize++;
    } else {
        self.logger.error('addToStatsBuffer: Invalid metric lines: ' + metricLines);
    }
}

var SystemStatsPlugin = function (configs) {
    if (!configs) { configs = {}; }

    // System Metrics
    this.metrics = {
        bufferFlushLength: configs.bufferFlushLength || false,
        timerEventLoop: configs.timerEventLoop || false,
        processUptime: configs.processUptime || false,
        processMemoryUsage: configs.processMemoryUsage || false,
        processMemoryUsagePerc: configs.processMemoryUsagePerc || false,
        osCpuUsage: configs.osCpuUsage || false,
        osUptime: configs.osUptime || false,
        osTotalMemory: configs.osTotalMemory || false,
        osFreeMemory: configs.osFreeMemory || false
    };

    // System Tags
    this.tags = {
        hostname: configs.tagHostname || false,
        platform: configs.tagPlatform || false,
        architecture: configs.tagArchitecture || false,
        nodeVersion: configs.tagNodeVersion || false
    };
};

SystemStatsPlugin.prototype.onInit = function (client) {
    client.pluginBuffers.systemStats = {
        buffer: '',
        bufferSize: 0
    };

    var tags = {};

    if (this.tags.hostname) {
        tags.hostname = os.hostname();
    }
    if (this.tags.platform) {
        tags.platform = os.platform();
    }
    if (this.tags.architecture) {
        tags.architecture = os.arch();
    }
    if (this.tags.nodeVersion) {
        tags.node_version = process.version;
    }

    client.tags = merge(client.tags, tags);

    if (this.metrics.timerEventLoop) {
        blocked(function (ms) {
            putSystemStatsMetrics(client, 'timer.event_loop', ms, {
                agg: ['avg', 'p90', 'count'],
                tags: { unit: 'ms' }
            });
        });
    }
};

function pluginsBuffersSize (buffers) {
    var size = 0;

    for (var i in buffers) {
        size += buffers[i].bufferSize;
    }

    return size;
}

SystemStatsPlugin.prototype.onFlush = function (client) {
    //process
    var procMem = process.memoryUsage().rss,
        osTotMem = os.totalmem(),
        osFreeMem = os.freemem(),
        procMemPerc = (procMem * 100) / osTotMem,
        procUptimeMs = process.uptime() * 1000,
        osUptimeMs = os.uptime() * 1000;

    if (this.metrics.bufferFlushLength) {
        var aggregations = ['avg', 'sum'];
        if (client.aggregatedBuffer.bufferSize > 0 && client.transport === 'api') {
            putSystemStatsMetrics(client, 'buffer.flush_length', client.aggregatedBuffer.bufferSize, {
                agg: aggregations,
                tags: { buffer_type: 'aggregated' }
            });
        }
        if (client.nonAggregatedBuffer.bufferSize > 0) {
            putSystemStatsMetrics(client, 'buffer.flush_length', client.nonAggregatedBuffer.bufferSize, {
                agg: aggregations,
                tags: { buffer_type: 'non-aggregated' }
            });
        }
        if (pluginsBuffersSize(client.pluginBuffers) > 0) {
            putSystemStatsMetrics(client, 'buffer.flush_length', pluginsBuffersSize(client.pluginBuffers), {
                agg: aggregations,
                tags: { buffer_type: 'system-stats' }
            });
        }
    }

    if (this.metrics.processUptime) {
        putSystemStatsMetrics(client, 'process.uptime', procUptimeMs, {
            agg: ['avg', 'last'],
            tags: { unit: 'ms' }
        });
    }

    if (this.metrics.processMemoryUsage) {
        putSystemStatsMetrics(client, 'process.memory.usage', procMem, {
            agg: ['avg', 'last'],
            tags: { unit: 'byte' }
        });
    }

    if (this.metrics.processMemoryUsagePerc) {
        putSystemStatsMetrics(client, 'process.memory.usage.perc', procMemPerc, {
            agg: ['avg', 'last']
        });
    }

    if (this.metrics.osTotalMemory) {
        putSystemStatsMetrics(client, 'os.memory.total', osTotMem, {
            agg: ['avg', 'last']
        });
    }

    if (this.metrics.osFreeMemory) {
        putSystemStatsMetrics(client, 'os.memory.free', osFreeMem, {
            agg: ['avg', 'last']
        });
    }

    if (this.metrics.osUptime) {
        putSystemStatsMetrics(client, 'os.uptime', osUptimeMs, {
            agg: ['avg', 'last'],
            tags: { unit: 'ms' }
        });
    }
};

module.exports = SystemStatsPlugin;