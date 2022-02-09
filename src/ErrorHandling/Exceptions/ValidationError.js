const ApplicationError = require('./ApplicationError');

class ValidationError extends ApplicationError
{
    /**
     * @param {string} message
     */
    constructor(message)
    {
        super(message);
        this.name = 'ValidationError';
        this.message = message;
        this.status = 400;
    }
}

module.exports = ValidationError;