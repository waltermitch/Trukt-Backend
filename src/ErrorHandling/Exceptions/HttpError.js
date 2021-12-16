class HttpError extends Error
{
    /**
     * @description This class is a custom exception class meant to be used for throwing errors when http eceptions happen
     * @param {Integer} status The status code result from the exception
     * @param {String} message The error message sent to the user
     */
    constructor(status, message)
    {
        super(message);
        this.status = status;
    }

    toJson()
    {
        const json = { message: this.message };
        Object.assign(json, this);
        delete json.status;

        return json;
    }
}

module.exports = HttpError;
