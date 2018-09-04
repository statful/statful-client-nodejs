var Logger = require('../lib/logger');
var expect = require('chai').expect;
var sinon = require('sinon');

describe('Logger', () => {
    it('should not be null', () => {
        expect(Logger).to.not.be.null;
    });

    it('should create a new Logger Instance', () => {
        var instance = new Logger('logger');

        expect(instance.logger).to.equal('logger');
    });

    it('should call logger functions', () => {
        var loggerClient = {
            log: () => {},
            info: () => {},
            warn: () => {},
            debug: () => {},
            error: () => {}
        };

        sinon.spy(loggerClient, 'log');
        sinon.spy(loggerClient, 'info');
        sinon.spy(loggerClient, 'warn');
        sinon.spy(loggerClient, 'debug');
        sinon.spy(loggerClient, 'error');

        var instance = new Logger(loggerClient);

        instance.log('text');
        expect(loggerClient.log.getCall(0).args[0]).to.equal('text');

        instance.info('text');
        expect(loggerClient.info.getCall(0).args[0]).to.equal('text');

        instance.warn('text');
        expect(loggerClient.warn.getCall(0).args[0]).to.equal('text');

        instance.debug('text');
        expect(loggerClient.debug.getCall(0).args[0]).to.equal('text');

        instance.error('text');
        expect(loggerClient.error.getCall(0).args[0]).to.equal('text');
    });
});
