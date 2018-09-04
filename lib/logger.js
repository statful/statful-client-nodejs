function Logger (logger) {
    this.logger = logger;
}

Logger.prototype.log = function (text) {
    this.logger && this.logger.log && this.logger.log(text);
};
Logger.prototype.info = function (text) {
    this.logger && this.logger.info && this.logger.info(text);
};
Logger.prototype.warn = function (text) {
    this.logger && this.logger.warn && this.logger.warn(text);
};
Logger.prototype.debug = function (text) {
    this.logger && this.logger.debug && this.logger.debug(text);
};
Logger.prototype.error = function (text) {
    this.logger && this.logger.error && this.logger.error(text);
};

module.exports = Logger;
