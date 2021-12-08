const validatorErrors = require('express-openapi-validator').error;
const HttpError = require('./ErrorHandling/Exceptions/HttpError');

/* eslint-disable */
module.exports = (err, request, response, next) =>
{
    let status;
    let data;

    // handle openapi validator errors
    if (err?.constructor?.name in validatorErrors)
    {
        response.status(err.status);
        response.json({
            errors: err.errors
        });
        return;
    } else if (err instanceof HttpError)
    {
        response.status(err.status)
        response.json({
            errors: [ err.toJson() ]
        })
        return;
    }
    // this is to catch weirdo errors everyone keep inventing.
    if (err.status)
    {
        if (typeof err.error === 'string')
        {
            err.message = err.error;
            delete err.error;
        }
        response.status(err.status);
        delete err.status;
        response.json({
            errors: [err]
        });
        return;
    }
    if (err?.response?.data)
    {
        status = err.response.status;
        data = err.response.data;
    }
    else if (err?.reason?.response)
    {
        status = err.reason?.response?.status;
        data = err.reason?.response?.data;
    }
    else if (err?.reason)
    {
        data = err.reason;
    }
    else if (err?.status && err.data)
    {
        status = err.status;
        data = err.data;
    }
    else if (err?.errors || err?.error)
    {
        status = 500;
        data = err;
    }
    else
    {
        status = err.status || 500;
        data = err.toString();
    }

    console.log(err);
    response.status(status);
    response.send(data);
};