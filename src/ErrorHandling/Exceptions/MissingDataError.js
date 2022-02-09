const ApplicationError = require('./ApplicationError');

class MissingDataError extends ApplicationError
{
    /**
     * @param {string} message
     */
    constructor(message)
    {
        super(message, 400);
        this.name = 'MissingDataError';
    }
}

module.exports = MissingDataError;