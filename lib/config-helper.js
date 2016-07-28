'use strict';

var concat = require('unique-concat');

var validAggregations = ['avg', 'sum', 'count', 'first', 'last', 'p90', 'p95', 'min', 'max'];

function isInteger(number) {
    return Number(number) === number && number % 1 === 0;
}

function isAggregationFrequencyInRange(frequency) {
    return isInteger(frequency) && frequency >= 1 && frequency <= 100;
}

function isArray(variable) {
    return variable.constructor === Array;
}

function isObject(variable) {
    return typeof variable === 'object' && !isArray(variable);
}

function isAggregationValid(aggregation) {
    return validAggregations.indexOf(aggregation) >= 0;
}

function areAggregationTypesValid(aggregations) {
    for (var i = 0; i < aggregations.length; i++) {
        if (!isAggregationValid(aggregations[i])) {
            return false;
        }
    }
    return true;
}

/**
 * Checks if the specified aggregations array is valid.
 *
 * @param aggregations An array with aggregations to validate
 * @returns {boolean} Returns true if the specified aggregations array is valid
 */
function areAggregationsValid(aggregations) {
    return typeof aggregations === 'undefined' || aggregations === null ||
        (isArray(aggregations) && areAggregationTypesValid(aggregations));
}

/**
 * Checks if the specified aggregation frequency is valid.
 *
 * @param frequency The aggregations frequency as an integer
 * @returns {boolean} Returns true if the aggregation frequency is valid
 */
function isAggregationFrequencyValid(frequency) {
    return typeof frequency === 'undefined' || frequency === null || isAggregationFrequencyInRange(frequency) ;
}

/**
 * Checks if the specified tags object is valid
 *
 * @param tags An object with tags
 * @returns {boolean} Returns true if the specified tags object is valid
 */
function isTagsObjectValid(tags) {
    return typeof tags === 'undefined' || tags === null || isObject(tags);
}

/**
 * Checks if the specified configuration object for metric types is valid.
 *
 * @param configuration The metric type configuration object
 * @returns {boolean} Returns true if the configuration is valid
 */
function isMetricTypesConfigurationValid(configuration) {
    return areAggregationsValid(configuration.agg) &&
        isAggregationFrequencyValid(configuration.aggFreq) &&
        isTagsObjectValid(configuration.tags);
}

/**
 * Checks if the specified arguments are valid for a metric type.
 *
 * @param aggregations Aggregations array
 * @param aggregationFrequency Frequency as an integer
 * @param tags An object with tags
 * @returns {boolean} Returns true if the arguments are valid
 */
function areMetricTypesArgumentsValid(aggregations, aggregationFrequency, tags) {
    return areAggregationsValid(aggregations) &&
        isAggregationFrequencyValid(aggregationFrequency) &&
        isTagsObjectValid(tags);
}

/**
 * Overrides the default configuration with the specified configuration.
 *
 * @param defaultConfig The default configuration to override
 * @param overrideConfig The configuration that will override
 */
function overrideDefaultConfig(defaultConfig, overrideConfig) {
    if (overrideConfig) {
        if (!isMetricTypesConfigurationValid(overrideConfig)) {
            throw 'Metric type configuration is invalid, please read the documentation';
        }

        defaultConfig.agg = overrideConfig.agg || defaultConfig.agg;
        defaultConfig.aggFreq = overrideConfig.aggFreq || defaultConfig.aggFreq;
        defaultConfig.tags = overrideConfig.tags || defaultConfig.tags;
    }
}

/**
 * Overrides the default metric type configurations with the specified configurations.
 *
 * @param defaultConfig The default configurations to override
 * @param overrideConfig The configurations that will override
 */
function overrideMetricDefaultConfigs(defaultConfig, overrideConfig) {
    if (overrideConfig) {
        overrideDefaultConfig(defaultConfig.timer, overrideConfig.timer);
        overrideDefaultConfig(defaultConfig.counter, overrideConfig.counter);
        overrideDefaultConfig(defaultConfig.gauge, overrideConfig.gauge);
    }
}

/**
 * Concatenates two arrays of aggregations and return a new array of unique aggregations.
 *
 * @param left The left array of configurations to merge
 * @param right The left array of configurations to merge
 * @returns {*} An array of unique aggregations
 */
function concatAggregations(left, right) {
    var aggregations;

    if (left !== undefined && left !== null) {
        aggregations = concat(left, right || []);
    } else {
        aggregations = right;
    }

    return aggregations;
}

exports.areAggregationsValid = areAggregationsValid;
exports.isAggregationFrequencyValid = isAggregationFrequencyInRange;
exports.isTagsObjectValid = isTagsObjectValid;
exports.isMetricTypesConfigurationValid = isMetricTypesConfigurationValid;
exports.areMetricTypesArgumentsValid = areMetricTypesArgumentsValid;
exports.overrideMetricDefaultConfigs = overrideMetricDefaultConfigs;
exports.concatAggregations = concatAggregations;