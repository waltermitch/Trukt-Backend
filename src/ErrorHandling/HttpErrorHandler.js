const { ValidationError, NotFoundError, DBError, ConstraintViolationError, UniqueViolationError, NotNullViolationError, ForeignKeyViolationError, CheckViolationError, DataError } = require('objection');
const validatorErrors = require('express-openapi-validator').error;
const HttpError = require('./Exceptions/HttpError');
const telemetryClient = require('./Insights');

/* eslint-disable */
module.exports = (errors, request, response, next) =>
{
    // console.log({errors, errorName: errors.constructor.name});
    if (errors instanceof ValidationError)
    {
        switch (errors.type) {
            case 'ModelValidation':
            case 'RelationExpression':
            case 'UnallowedRelation':
            case 'InvalidGraph':
            default:
                telemetryClient.trackException({
                    exception: errors,
                    severity: 2,
                })
                response.status(400).send({
                    status: 400,
                    errors: [
                        {
                            errorType: errors.type,
                            message: errors.message,
                        }
                    ],
                    data: errors.data
                });
                break;
        }
    } else if (errors instanceof NotFoundError)
    {
        telemetryClient.trackException({
            exception: errors,
            severity: 2,
        })
        response.status(404).send({
            status: 404,
            errors: [
                {
                    errorType: errors.name,
                    message: errors.message,
                    
                }
            ],
            data: errors.data
        });
    } else if (errors instanceof UniqueViolationError || errors instanceof ForeignKeyViolationError)
    {
        telemetryClient.trackException({
            exception: errors,
            severity: 3,
        })
        response.status(409).send({
            status: 409,
            errors: [
                {
                    errorType: errors.name,
                    message: errors.nativeError.detail,
                    code: errors.nativeError.code,
                }
            ],
            data: errors.data,
        });
    } else if (errors instanceof NotNullViolationError || errors instanceof CheckViolationError || errors instanceof DataError)
    {
        telemetryClient.trackException({
            exception: errors,
            severity: 3,
        })
        response.status(400).send({
            status: 400,
            errors: [
                {
                    errorType: errors.name,
                    message: errors.nativeError.detail,
                    code: errors.nativeError.code
                }
            ],
            data: errors.data
        });
    } else if (errors instanceof DBError)
    {
        telemetryClient.trackException({
            exception: errors,
            severity: 4,
        })
        response.status(500).send({
            status: 500,
            errors: [
                {
                    errorType: 'DBError',
                    message: errors.message,
                }
            ],
            data: errors.data
        });
    } else if (errors instanceof HttpError || errors.constructor.name === 'HttpError')
    {
        telemetryClient.trackException({
            exception: errors,
            severity: 2,
        })
        response.status(errors.status).send({
            status: errors.status,
            errors: [
                {
                    errorType: 'HttpError',
                    message: errors.message,
                }
            ],
            data: {}
        });
    } else if (errors instanceof Error)
    {
        telemetryClient.trackException({
            exception: errors,
            severity: 3,
        })
        response.status(500).send({
            status: 500,
            errors: [
                {
                    errorType: errors.name,
                    message: errors.message,
                }
            ]
        });
    } else if (Array.isArray(errors))
    {
        // TODO: Set error exception in Application Azure Insights with the class designated for bulk actions

        response.status(500).send({
            status: 500,
            errors: errors.map(error => ({
                errorType: error.name,
                message: error.message,
            }))
        });
    } else
    {
        telemetryClient.trackException({
            exception: errors,
            severity: 3,
        })
        response.status(500).send({
            status: 500,
            errors: [
                {
                    errorType: 'UnknownError',
                    message: errors.toString(),
                }
            ],
            data: {}
        });
    }
};
