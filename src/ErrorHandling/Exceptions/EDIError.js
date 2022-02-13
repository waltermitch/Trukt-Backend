class EDIError extends Error
{
    constructor(input)
    {
        super(input);
        this.name = this.constructor.name;
        this.request;
        this.response;
    }

    addRequest(req)
    {
        this.httpRequest = req;
    }

    addResponse(res)
    {
        this.httpResponse = res;
    }
}

module.exports = EDIError;