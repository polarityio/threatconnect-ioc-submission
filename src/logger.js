let logger;

function setLogger (Logger) {
    logger = Logger;
}

function getLogger () {
    return logger;
}

module.exports = {
    setLogger,
    getLogger
};
