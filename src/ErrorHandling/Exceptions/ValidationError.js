const ApplicationError = require('./ApplicationError');

class ValidationError extends ApplicationError
{
    /**
     * @param {string} message
     * @param {Record<string, unknown>} [helperInfo] - additional information to help with debugging
     */
    constructor(message, helperInfo)
    {
        super(message, 400, helperInfo);
        this.name = this.constructor.name;
    }
}

module.exports = ValidationError;