
Statful Client for NodeJS
==============

[![NPM version][npm-image]][npm-url] [![Build Status](https://travis-ci.org/statful/statful-client-nodejs.svg?branch=master)](https://travis-ci.org/statful/statful-client-nodejs)

Statful client for NodeJS written in Javascript. This client is intended to gather metrics and send them to Statful.

## Table of Contents

* [Supported Versions of NodeJS](#supported-versions-of-nodejs)
* [Installation](#installation)
* [Quick Start](#quick-start)
* [Reference](#reference)
  * [Global Configuration](#global-configuration)
  * [Methods](#methods)
  * [Plugins](#plugins)
* [Examples](#examples)
  * [UDP Configuration](#udp-configuration)
  * [HTTP Configuration](#http-configuration)
  * [Logger Configuration](#logger-configuration)
   * [Configuration of Defaults per Method](#configuration-of-defaults-per-method)
  * [Preset Configuration](#preset-configuration)
  * [Send Metrics Configuration](#send-metrics-configuration)
 * [Authors](#authors)
* [License](#license)

## Supported Versions of NodeJS

| Statful Client version | Tested NodeJS versions  |
|:---|:---|
| 4.x.x | `4.4.0`, `5.12.0`, `6.9.2`, `7.10.1`, `8.2.0` |
| 5.x.x | `6.9.2`, `7.10.1`, `8.2.0`, `10.9.0` |
| 6.x.x | `8.2.0`, `8.12.0`, `10.12.0`, `11.0.0` |

## Installation

First, install Statful’s NodeJS Client into your System, in the same path as your JS file, by executing the below command:

```bash
$ npm install statful-client --save
```

## Quick Start

After installing Statful’s NodeJS Client, you are ready to push your metric into Statful by adding the below code into your JS file:

```javascript
var Statful = require('statful-client');

// Creates an object with the desired configuration and pass it to the client
var config = {
    app: 'AccountService',
    transport: 'api',
    api: {
        token: 'STATFUL_API_TOKEN'
        host: 'api.statful.com'
        port: 443
    },
    tags: { cluster: 'production' }
};
var statful = new Statful(config);

// Send a `counter` metric
statful.counter('transactions', 1);
```

> **IMPORTANT:** This configuration uses the default **host** and **port**. You can find these default values in the below table. 
[More configurations are available in the [Examples](#examples) section].  
The host and port need to be added within the api Object as shown in the above code.  
Your token value is available in the 'Api Tokens' page of the Website.

## Reference

The following section presents a detailed reference of the available options to take full advantage of Statful.

### Global Configuration

Below you can find the information on the custom options to set up the configurations parameters.

| Option | Description | Type | Default | Required |
|:---|:---|:---|:---|:---|
| _app_ | Defines the application's global name. When specified, it sets a global tag like `app=setValue`. | `string` | **none** | **NO** |
| _default_ | Object for setting methods' options. | `object` | `{}` | **NO** |
| _api_ | Object for setting API configurations: authentication and timeout. | `object` | **none** | **NO** |
| _dryRun_ | Defines if metrics should be output to the logger instead of being sent to Statful (useful for testing/debugging purposes). | `boolean` | `false` | **NO** |
| _flushInterval_ | Defines the periodicity of buffer flushes in **milliseconds**. | `number` | `3000` | **NO** |
| _flushSize_ | Defines the maximum buffer size before performing a flush, in **milliseconds**. | `number` | `1000` | **NO** |
| _namespace_ | Defines the global namespace. A prefix could be set if the user sends metrics through Statful. | `string` | `application` | **NO** |
| _sampleRate_ | Defines the rate sampling. **It should be a number between [1, 100]**. | `number` | `100` | **NO** |
| _tags_ | Object for setting the global tags. | `object` | `{}` | **NO** |
| _transport_ | Defines the transport layer to be used to send metrics.<br><br> **Valid Transports:** `udp, api` | `string` | **none** | **YES** |
| _host_ | Defines the hostname to where the metrics are sent. It has to be set for api or UDP whichever is applicable. | `string` | UDP: `127.0.0.1` | **NO** |
| _path_ | Defines the API path to where the metrics are sent. It can only be set inside _api_. | `string` | `/tel/v2.0/metric` | **NO** |
| _port_ | Defines the port where the metrics are sent. It can only be set inside _api_. | `string` | `443` | **NO** |
| _token_ | Defines the token used to match incoming data to Statful. It can only be set inside _api_. | `string` | **none** | **YES** |
| _timeout_ | Defines the timeout for the transport layers in **milliseconds**. It can only be set inside _api_. | `number` | `2000` | **NO** |

### Methods

```javascript
// Non-Aggregated Metrics
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
The methods for non-aggregated metrics receive a metric name and value as arguments and send a counter, a gauge, a timer or a custom metric.

The methods for aggregated metrics receive a metric name and value, an aggregation and an aggregation frequency (the one used beforehand to aggregate the metric) as arguments, and send a counter, a gauge, a timer or a custom metric. Whenever the options parameter is left out, the default values are used instead.

The latter methods are a valuable asset to address the need of ingestion of already aggregated metrics into Statful (for example, aggregated metrics from AWS CloudWatch). For more information about the default values, read the methods options' reference presented next.

> **IMPORTANT:** You can only send aggregated metrics with an `api` transport type. Otherwise, the metrics are discarded, and they will not be sent.

| Description | Default for Counter | Default for Gauge | Default for Timer | Default for Put | Available for Aggregated Methods |
|:---|:---|:---|:---|:---|:---|
| **_agg_** (`array`)  - Defines the aggregations to execute. These aggregations are merged with the ones configured globally, including method defaults.<br><br> **Valid Aggregations:** `avg, count, sum, first, last, p90, p95, p99, min, max` | `['sum', 'count']` | `['last']` | `['avg', 'p90', 'count']` | `[]` | **NO** |
| **_aggFreq_** (`number`) - Defines the aggregation frequency, in **seconds**. It overrides the global aggregation frequency configuration.<br><br> **Valid Aggregation Frequencies:** `10, 30, 60, 120, 180, 300` | `10` | `10` | `10` | `10` | **NO** |
| **_namespace_** (`string`)  - Defines the namespace of the metric. It overrides the global namespace configuration. | `application` | `application` | `application` | `application` | **YES** |
| **_tags_** (`object`) - Defines the tags of the metric. These tags are merged with the ones configured globally, including method defaults. | `{}` | `{}` | `{ unit: 'ms' }` | `{}` | **YES** |
| **_timestamp_** (`string`)  - Defines the timestamp of the metric. This timestamp is a **UNIX Epoch** time, represented in **seconds**.  | `current timestamp` | `current timestamp` | `current timestamp` | `current timestamp` | **YES** |

## Plugins

### System Stats Plugin

This plugin allows the client to send system-related metrics and to enrich the user's metrics with system tags.

It is possible to use this plugin with the client as follows:
```javascript
    var SystemStatsPlugin = require('statful-client').systemStatsPlugin;
    var statful = new Statful(config, log);
    statful.use(new SystemStatsPlugin());
```

#### System Stats Plugin Configuration

The custom options available to set on config param are detailed below.

| Option | Display name | Description | Type | Default | Required |
|:---|:---|:---|:---|:---|:---|
| _bufferFlushLength_ | `.buffler.flush_length` | Length of the queue on flush events | `number` | **none**| **NO** |
| _timerEventLoop_ | `.timer.event_loop` | Time spent to execute the callback in **milliseconds** | `number` | **none**| **NO** |
| _processUptime_ | `.process.uptime` | Uptime of the process in **milliseconds** | `number` | **none**| **NO** |
| _processMemoryUsage_ | `process.memory.usage` | Process memory usage in **bytes** | `number` | **none**| **NO** |
| _processMemoryUsagePerc_ | `process.memory.usage.perc` | Process memory usage in **percentage** (compared to total OS memory) | `number` | **none**| **NO** |
| _osUptime_ | `.os.uptime` | OS uptime in **milliseconds** | `number` | **none**| **NO** |
| _osTotalMemory_ | `.os.memory.total` | OS total memory in **bytes** | `number` | **none**| **NO** |
| _osFreeMemory_ | `os.memory.free` | OS free memory in **bytes** | `number` | **none**| **NO** |
| _tagHostname_ | `hostname` | Hostname | `string` | **none**| **NO** |
| _tagPlatform_ | `platform` | Platform | `string` | **none**| **NO** |
| _tagArchitecture_ | `architecture` | Architecture | `string` | **none**| **NO** |
| _tagNodeVersion_ | `node_version` | NodeJS Version | `string` | **none**| **NO** |

## Examples

Here you can find some useful usage examples of the Statful’s NodeJS Client. In the following examples, we assume that you have already installed and included the Statful Client in your project with success.

### UDP Configuration

Create a simple UDP configuration for the client.

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

Create a simple HTTP API configuration for the client.

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

Create a simple client configuration to add your favorite logger to the client such as Bunyan, Winston or others. **The only requirement is to make sure that the chosen logger object supports: log, info, warn, debug and error methods.**

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

### Configuration of Defaults per Method

Create a configuration for the client where you define custom default options per method.

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

### Preset Configuration

Create a configuration where you define a value for currently available options.

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

### Send Metrics Configuration

Create a simple client configuration to send a few metrics.

```javascript
var Statful = require('statful-client');

var config = {
    app: 'AccountService',
    transport: 'udp',
    host: 'statful-relay.yourcompany.com',
    tags: { cluster: 'production' }
};

var statful = new Statful(config);

// Send three different metrics (gauge, timer and counter)
statful.gauge('testGauge', 10);
statful.timer('testTimer', 100);
statful.counter('testCounter', 1, { agg: ['first'], aggFreq: 60, namespace: 'sandbox' });

// Send a metric with custom tags
statful.counter('testCounter', 1, {tags: {host: 'localhost', status: 'SUCCESS'}});
```

## Authors

[Mindera - Software Craft](https://github.com/Mindera)

## License

Statful NodeJS Client is available under the MIT license. See the [LICENSE](https://raw.githubusercontent.com/statful/statful-client-objc/master/LICENSE) file for more information.

[npm-url]: https://npmjs.org/package/statful-client
[npm-image]: https://badge.fury.io/js/statful-client.svg
