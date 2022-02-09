const ApplicationError = require('./ApplicationError');

class DataConflictError extends ApplicationError
{
    /**
     * @param {string} message
     */
    constructor(message)
    {
        super(message);
        this.name = 'DataConflictError';
        this.message = message;
        this.status = 400;
    }
}

module.exports = DataConflictError;