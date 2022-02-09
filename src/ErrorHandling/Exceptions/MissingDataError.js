const ApplicationError = require('./ApplicationError');

class MissingDataError extends ApplicationError
{
    /**
     * @param {string} message
     */
    constructor(message)
    {
        super(message);
        this.name = 'MissingDataError';
        this.message = message;
        this.status = 400;
    }
}

module.exports = MissingDataError;