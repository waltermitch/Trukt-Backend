const ApplicationError = require('./ApplicationError');

class ValidationError extends ApplicationError
{
    /**
     * @param {string} message
     */
    constructor(message)
    {
        super(message, 400);
        this.name = 'ValidationError';
    }
}

module.exports = ValidationError;