const ApplicationError = require('./ApplicationError');

class DataConflictError extends ApplicationError
{
    /**
     * @param {string} message
     */
    constructor(message)
    {
        super(message, 400);
        this.name = 'DataConflictError';
    }
}

module.exports = DataConflictError;