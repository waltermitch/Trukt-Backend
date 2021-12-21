const validatorErrors = require('express-openapi-validator').error;
const HttpError = require('./Exceptions/HttpError');
const telemetryClient = require('./Insights');

/* eslint-disable */
module.exports = (errors, request, response, next) =>
{
    if(!Array.isArray(errors))
    {
        errors = [errors];
    }
    let status;
    let data = {
        errors: []
    };
    for(const e of errors)
    {
        // handle openapi validator errors
        if (e?.constructor?.name in validatorErrors)
        {
            response.status(e.status);
            response.json({
                errors: e.errors
            });
            return;
        } else if (e.constructor.name == 'HttpError')
        {
            status = 400;
            data.errors.push(e.toJson());
            return;
        }
        status = e?.status ?? 500;
        data.errors.push(e);
    }
    console.log(...errors);
    response.status(status);
    response.send(data);
};