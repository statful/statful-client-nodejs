var URL = require('url');
var https = require('https');
var zlib = require('zlib');
var Readable = require('stream').Readable;

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
function buildRequestOptions (protocol, host, port, path, token, timeout) {
    return {
        url: protocol + '://' + host + ':' + port + path,
        method: 'PUT',
        headers: {
            'Content-Type': 'text/plain',
            'User-Agent': 'statful-client-nodejs',
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
function getGzipStreamFromString (string) {
    var messageStream = new Readable();
    messageStream.push(string);
    messageStream.push(null);

    return messageStream.pipe(zlib.createGzip());
}

/**
 * Execute the request using the specified options.
 *
 * @param options The options to use in the request.
 * @param logger A logger instance.
 *
 * @returns {*|exports}
 */
function performRequest (options, logger) {
    var url = URL.parse(options.url);
    var req;

    options.hostname = url.hostname;
    options.port = url.port;
    options.path = url.path;

    req = https.request(options, function callback (res) {
        res.setEncoding('utf8');
    });

    req.on('error', function (e) {
        if (e.code === 'ECONNRESET') {
            logger.error(
                'A timeout occurred on a request to host: ' +
                    options.hostname +
                    ' port: ' +
                    options.port +
                    ' and path: ' +
                    options.path
            );
        } else {
            logger.error('An error occurred: ' + e.message);
        }
    });

    req.on('socket', function (socket) {
        socket.setTimeout(options.timeout);
        socket.on('timeout', function () {
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
function sendCompressedMessage (options, message, logger) {
    options.headers['Content-Encoding'] = 'gzip';

    getGzipStreamFromString(message).pipe(performRequest(options, logger));
}

/**
 * Sends the specified message without using any compression.
 *
 * @param options The options to use in the request.
 * @param message The message to send in the request.
 * @param logger A logger instance.
 */
function sendUncompressedMessage (options, message, logger) {
    options.body = message;

    performRequest(options, logger);
}

exports.buildRequestOptions = buildRequestOptions;
exports.getGzipStreamFromString = getGzipStreamFromString;
exports.performRequest = performRequest;
exports.sendCompressedMessage = sendCompressedMessage;
exports.sendUncompressedMessage = sendUncompressedMessage;
