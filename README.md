Statful Client for NodeJS
==============

[![NPM version][npm-image]][npm-url] [![Build Status](https://travis-ci.org/statful/statful-client-nodejs.svg?branch=master)](https://travis-ci.org/statful/statful-client-nodejs)

Statful client for NodeJS written in Javascript. This client is intended to gather metrics and send them to Statful.

## Table of Contents

* [Supported Versions of NodeJS](#supported-versions-of-nodejs)
* [Installation](#installation)
* [Quick Start](#quick-start)
* [Examples](#examples)
* [Reference](#reference)
* [Authors](#authors)
* [License](#license)

## Supported Versions of NodeJS

| Statful client Version | Tested NodeJS versions  |
|:---|:---|
| 4.x.x | `4.4.0`, `5.12.0`, `6.9.2`, `7.10.1`, `8.2.0`  |
| 5.x.x | `6.9.2`, `7.10.1`, `8.2.0`, `10.9.0`  |

## Installation

```bash
$ npm install statful-client --save
```

## Quick start

After installing Statful Client you are ready to use it. The quickest way is to do the following:

```javascript
var Statful = require('statful-client');

// Creates an object with the configuration and pass it to the client
var config = {
    app: 'AccountService',
    transport: 'api',
    api: {
        token: 'STATFUL_API_TOKEN'
    },
    tags: { cluster: 'production' }
};
var statful = new Statful(config);

// Send a metric
statful.counter('transactions', 1);
```

> **IMPORTANT:** This configuration uses the default **host** and **port**. You can learn more about configuration in [Reference](#reference).

## Examples

You can find here some useful usage examples of the Statful Client. In the following examples is assumed you have already installed and included Statful Client in your project.

### UDP Configuration

Creates a simple UDP configuration for the client.

```javascript
var Statful = require('statful-client');

var config = {
    app: 'AccountService',
    transport: 'udp',
    host: 'statful-relay.yourcompany.com',
    tags: { cluster: 'production' }
};

var statful = new Statful(config);
```

### HTTP Configuration

Creates a simple HTTP API configuration for the client.

```javascript
var Statful = require('statful-client');

var config = {
    app: 'AccountService',
    transport: 'api',
    api: {
        token: 'STATFUL_API_TOKEN'
    },
    tags: { cluster: 'production' }
};

var statful = new Statful(config);
```

### Logger configuration

Creates a simple client configuration and adds your favourite logger to the client like Bunyan, Winston or any other you want. **Just assure that logger object supports: log, info, warn, debug and error methods**.

```javascript
var Statful = require('statful-client');
var logger = require('your-favourite-logging-lib');

var config = {
    app: 'AccountService',
    transport: 'api',
    api: {
        token: 'STATFUL_API_TOKEN'
    },
    tags: { cluster: 'production' }
};

var statful = new Statful(config, logger);
```

### Defaults Configuration Per Method

Creates a configuration for the client with custom default options per method.

```javascript
var Statful = require('statful-client');

var config = {
    default: {
        counter: { agg: ['avg'], aggFreq: 180 },
        gauge: { agg: ['first'], aggFreq: 180 },
        timer: { tags: { cluster: 'qa' }, agg: ['count'], aggFreq: 180 }
    },
    tags: { cluster: 'production' },
    api: {
        token: 'STATFUL_API_TOKEN'
    },
    transport: 'api'
}

var statful = new Statful(config);
```

### Mixed Complete Configuration

Creates a configuration defining a value for every available option.

```javascript
var Statful = require('statful-client');

var config = {
    default: {
        timer: { tags: { cluster: 'qa' }, agg: ['count'], aggFreq: 180 }
    },
    dryRun: true,
    flushInterval: 5000,
    flushSize: 50,
    transport: 'api',
    api: {
        timeout: 300,
        token: 'STATFUL_API_TOKEN'
    },
    namespace: 'application',
    tags: { cluster: 'production' }
}

var statful = new Statful(config);
```

### Add metrics

Creates a simple client configuration and use it to send some metrics.

```javascript
var Statful = require('statful-client');

var config = {
    app: 'AccountService',
    transport: 'udp',
    host: 'statful-relay.yourcompany.com',
    tags: { cluster: 'production' }
};

var statful = new Statful(config);

// Send three different metrics (gauge, timer and a counter)
statful.gauge('testGauge', 10);
statful.timer('testTimer', 100);
statful.counter('testCounter', 1, { agg: ['first'], aggFreq: 60, namespace: 'sandbox' });

// Metric to be sent with tags
statful.counter('testCounter', 1, {tags: {host: 'localhost', status: 'SUCCESS'}});
```

## Reference

Detailed reference if you want to take full advantage from Statful.

### Global configuration

The custom options that can be set on config param are detailed below.

| Option | Description | Type | Default | Required |
|:---|:---|:---|:---|:---|
| _app_ | Defines the application global name. If specified sets a global tag `app=setValue`. | `string` | **none** | **NO** |
| _default_ | Object to set methods options. | `object` | `{}` | **NO** |
| _api_ | Defined API configurations. | `object` | **none** | **NO** |
| _dryRun_ | Defines if metrics should be output to the logger instead of being send. | `boolean` | `false` | **NO** |
| _systemStats_ | Enables sending metrics with flush stats. | `boolean` | `true` | **NO** |
| _flushInterval_ | Defines the periodicity of buffer flushes in **miliseconds**. | `number` | `3000` | **NO** |
| _flushSize_ | Defines the maximum buffer size before performing a flush. | `number` | `1000` | **NO** |
| _namespace_ | Defines the global namespace. | `string` | `application` | **NO** |
| _sampleRate_ | Defines the rate sampling. **Should be a number between [1, 100]**. | `number` | `100` | **NO** |
| _tags_ | Defines the global tags. | `object` | `{}` | **NO** |
| _transport_ | Defines the transport layer to be used to send metrics.<br><br> **Valid Transports:** `udp, api` | `string` | **none** | **YES** |
| _host_ | Defines the host name to where the metrics should be sent. Can also be set inside _api_. | `string` | `127.0.0.1` | **NO** |
| _path_ | Defines the api path to where the metrics should be sent. Can also be set inside _api_. | `string` | `/tel/v2.0/metric` | **NO** |
| _port_ | Defines the port. Can also be set inside _api_. | `string` | `2013` | **NO** |
| _token_ | Defines the token to be used.  Must be set inside _api_. | `string` | **none** | **NO** |
| _timeout_ | Defines the timeout for the transport layers in **miliseconds**. Must be set inside _api_. | `number` | `2000` | **NO** |

### Methods

```javascript
// Non Aggregated Metrics
- statful.counter('myCounter', 1, {agg: ['sum']});
- statful.gauge('myGauge', 10, { tags: { host: 'localhost' } });
- statful.timer('myCounter', 200, {namespace: 'sandbox'});
- statful.put('myCustomMetric', 200, {timestamp: '1471519331'});

// Aggregated Metrics
- statful.aggregatedCounter('myCounter', 1, 'avg', 60, { tags: { host: 'localhost' } });
- statful.aggregatedGauge('myGauge', 10, 'avg', 60, { tags: { host: 'localhost' } });
- statful.aggregatedTimer('myCounter', 200, 'avg', 60, {namespace: 'sandbox'});
- statful.aggregatedPut('myCustomMetric', 200, 'avg', 60, {timestamp: '1471519331'});
```
The methods for non aggregated metrics receive a metric name and a metric value as arguments and send a counter/gauge/timer/custom metric.
The methods for aggregated metrics receive a metric name, a metric value, an aggregation and an aggregation frequency (used previously to aggregate the metric) as arguments and send a counter/gauge/timer/custom metric.
If the options parameter is omitted, the default values are used. Those methods are truly valuable due to need of ingest already aggregated metrics into Statful (for example from AWS CloudWatch).
Read the methods options reference bellow to get more information about the default values.

> **IMPORTANT:** You can only send aggregated metrics with `api` transport type. Otherwise metrics will be discarded and not be sent.

| Description | Default for Counter | Default for Gauge | Default for Timer | Default for Put | Available for Aggregated Methods |
|:---|:---|:---|:---|:---|:---|
| **_agg_** (`array`)  - Defines the aggregations to be executed. These aggregations are merged with the ones configured globally, including method defaults.<br><br> **Valid Aggregations:** `avg, count, sum, first, last, p90, p95, min, max` | `['sum', 'count']` | `[last]` | `['avg', 'p90', 'count']` | `[]` | **NO** |
| **_aggFreq_** (`number`) - Defines the aggregation frequency in **seconds**. It overrides the global aggregation frequency configuration.<br><br> **Valid Aggregation Frequencies:** `10, 30, 60, 120, 180, 300` | `10` | `10` | `10` | `10`' | **NO** |
| **_namespace_** (`string`)  - Defines the namespace of the metric. It overrides the global namespace configuration. | `application` | `application` | `application` | `application` | **YES** |
| **_tags_** (`object`) - Defines the tags of the metric. These tags are merged with the ones configured globally, including method defaults. | `{}` | `{}` | `{ unit: 'ms' }` | `{}` | **YES** |
| **_timestamp_** (`string`)  - Defines the timestamp of the metric. This timestamp is a **POSIX/Epoch** time in **seconds**.  | `current timestamp` | `current timestamp` | `current timestamp` | `current timestamp` | **YES** |

## Plugins
It is possible to use plugin with the client.
```javascript
    var SystemStatsPlugin = require('./plugins/system-stats.js');
    var statful = new Statful(config, log);
    statful.use(new SystemStatsPlugin());
```
### System Stats Plugin
This plugin allows the client to send system-related metrics and/or enrich the user metrics with system tags.

#### System Stats Plugin Configuration

The custom options that can be set on config param are detailed below.

| Option | Description | Type | Default | Required |
|:---|:---|:---|:---|:---|
| _bufferFlushLength_ | Defines the application global name. If specified sets a global tag `app=setValue`. | `metric` | true | **NO** |
| _timerEventLoop_ | Object to set methods options. | `metric` | true | **NO** |
| _processUptime_ | Uptime of the process in **miliseconds**. | `metric` | true | **NO** |
| _processMemoryUsage_ | Process memory usage in **bytes**. | `metric` | true | **NO** |
| _processMemoryUsagePerc_ | Process memory usage **percentage**. (compared to total OS memory) | `metric` | true | **NO** |
| _osUptime_ | OS uptime in **miliseconds**. | `metric` | true | **NO** |
| _osTotalMemory_ | OS total memory in **bytes**. | `metric` | true | **NO** |
| _osFreeMemory_ | OS free memory in **bytes**. | `metric` | true | **NO** |
| _tagHostname_ | Hostname. | `tag` | true | **NO** |
| _tagPlatform_ | Platform. | `tag` | true | **NO** |
| _tagArchitecture_ | Architecture. | `tag` | true | **NO** |
| _tagNodeVersion_ | NodeJS Version | `tag` | true | **NO** |

## Authors

[Mindera - Software Craft](https://github.com/Mindera)

## License

Statful NodeJS Client is available under the MIT license. See the [LICENSE](https://raw.githubusercontent.com/statful/statful-client-objc/master/LICENSE) file for more information.

[npm-url]: https://npmjs.org/package/statful-client
[npm-image]: https://badge.fury.io/js/statful-client.svg
