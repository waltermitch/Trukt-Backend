const ApplicationError = require('./ApplicationError');

class DataConflictError extends ApplicationError
{
    /**
     * @param {string} message
     */
    constructor(message)
    {
        super(message, 400);
        this.name = this.constructor.name;
    }
}

module.exports = DataConflictError;