Statful Client for NodeJS
==============

[![NPM version][npm-image]][npm-url] [![Build Status](https://travis-ci.org/statful/statful-client-nodejs.svg?branch=master)](https://https://travis-ci.org/statful/statful-client-nodejs)

NodeJS client for sending metrics to Statful

## Installation

```
npm install statful-client --save
```
## Description ##

Statful NodeJS client is intended to gather application and send them to the Statful server.

## Quick start - UDP client ##

To bootstrap a Statful client to use UDP protocol, the quickest way is to do the following:

    var Statful = require('statful-client');

    var statful = new Statful({ transport: 'udp' });

This configuration uses the default _host_ and _port_.

### Timer ###
The simplest way of sending a _timer_ metric to Statful can be done like this:

    statful.timer('response_time', 1000);

### Counter ###
Or, if you prefer to send a _counter_ metric to Statful:

    statful.counter('transactions', 1);

### Gauge ###
And finally, a _gauge_ metric to Statful can be preformed in the following way:

    statful.gauge('current_sessions', 2);

## Client configuration ##

To bootstrap the client, the following options can be used:

* __host__ [optional] [default: '127.0.0.1']
* __port__ [optional] [default: 2013]
* __secure__ [optional] [default: true] - enable or disable https
* __timeout__ [optional] [default: 1000ms] - socket timeout for http/tcp transports
* __token__ [optional] - An authentication token to send to Statful
* __app__ [optional] - if specified set a tag ‘app=foo’
* __dryrun__ [optional] [default: false] - do not actually send metrics when flushing the buffer
* __tags__ [optional] - global list of tags to set
* __sampleRate__ [optional] [default: 100] [between: 1-100] - global rate sampling
* __namespace__ [optional] [default: ‘application’] - default namespace (can be overridden in function calls)
* __flushSize__ [optional] [default: 10] - defines the periodicity of buffer flushes
* __flushInterval__ [optional] [default: 0] - Defines an interval to flush the metrics

### UDP Configuration example ###

    var statful = new Statful({
        transport: 'udp',
        host: 'telemetry-relay.yourcompany.com',
        app: 'AccountService',
        tags: { cluster: 'production' }
    });

### HTTP Configuration example ###
        
    var statful = new Statful({
        transport: 'http',
        host: 'telemetry-relay.yourcompany.com',
        token: 'MyAppToken',
        app: 'AccountService',
        tags: { cluster: 'production' }
    });

### Timer defaults configuration ###

The bellow example uses the _timer_ attribute to configure default timer tags, timer aggregations and timer aggregation frequency.
        
    var statful = new Statful({
        defaults: {
            timer: {
                agg: ['last'],
                aggFreq: 50,
                tags: { unit: 's' }
            }
        }
    });

### Counter defaults configuration ###

To configure Counter defaults configuration, you should use the _counter_ attribute. Please check the Timer defaults configuration for an example.

### Gauge defaults configuration ###

To configure Gauge defaults configuration, you should use the _gauge_ attribute. Please check the Timer defaults configuration for an example.

## Building metrics ##

### Building metrics tags ###

(name, value, tags, agg, aggFreq, namespace)

    statful.counter('transactions', 1, {tags: {host, 'localhost', status: 'SUCCESS'}});

### Adding metrics with aggregations ###

    statful.counter('transactions', 1, {agg: ['avg', 'p90'], aggFreq: 30});

### Adding metrics with namespace ###
    
    statful.counter('transactions', 1, {namespace: 'my-namespace'});
    
[npm-url]: https://npmjs.org/package/statful-client
[npm-image]: https://badge.fury.io/js/statful-client.svg
