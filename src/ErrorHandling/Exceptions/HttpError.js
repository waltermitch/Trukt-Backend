module.exports = class HttpError extends Error
{
    constructor(
            message,
            status,
            params,
            userId,
            body,
            exception,
            method,
            url
        )
    {
        super(message);
        this.message = message;
        this.name = 'HttpError';
        this.status = status;
        this.params = params;
        this.userId = userId;
        this.body = body;
        this.exception = exception;
        this.method = method;
        this.url = url;
    }
};
