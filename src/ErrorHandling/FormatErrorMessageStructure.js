const { ValidationError, NotFoundError, DBError, ConstraintViolationError, UniqueViolationError, NotNullViolationError, ForeignKeyViolationError, CheckViolationError, DataError } = require('objection');
const validatorErrors = require('express-openapi-validator').error;
const HttpError = require('./Exceptions/HttpError');
const telemetryClient = require('./Insights');

/**
 * Evaluates the error and returns the appropriate error message structure, also the error is logged to Azure App Insights.
 * @param {unknown} error
 * @returns {{status: number, errors: {errorType: string, message: string, code?: number | string}[], data: Record<string, unknown}}
 */
function formatErrorMessageStructure(error)
{
    // TODO: Set error types for custom app types
    if (error instanceof ValidationError)
    {
        switch (error.type)
        {
            case 'ModelValidation':
            case 'RelationExpression':
            case 'UnallowedRelation':
            case 'InvalidGraph':
            default:
                telemetryClient.trackException({
                    exception: error,
                    severity: 2
                });
                return {
                    status: 400,
                    errors: [
                        {
                            errorType: error.type,
                            message: error.message
                        }
                    ],
                    data: error.data
                };
        }
    }
    else if (error instanceof NotFoundError)
    {
        telemetryClient.trackException({
            exception: error,
            severity: 2
        });
        return {
            status: 404,
            errors: [
                {
                    errorType: error.name,
                    message: error.message
                    
                }
            ],
            data: error.data
        };
    }
    else if (
        error instanceof ConstraintViolationError
        || error instanceof UniqueViolationError
        || error instanceof NotNullViolationError
        || error instanceof ForeignKeyViolationError
        || error instanceof CheckViolationError
        || error instanceof DataError
    )
    {
        telemetryClient.trackException({
            exception: error,
            severity: 3
        });
        return {
            status: 500,
            errors: [
                {
                    errorType: error.name,
                    message: error.nativeError.detail,
                    code: error.nativeError.code
                }
            ],
            data: error.data
        };
    }
    else if (error instanceof DBError)
    {
        telemetryClient.trackException({
            exception: error,
            severity: 4
        });
        return {
            status: 500,
            errors: [
                {
                    errorType: error.name,
                    message: error.message
                }
            ],
            data: error.data
        };
    }
    else if (error instanceof HttpError || error.constructor.name === 'HttpError')
    {
        telemetryClient.trackException({
            exception: error,
            severity: 2
        });
        return {
            status: error.status,
            errors: [
                {
                    errorType: 'HttpError',
                    message: error.message
                }
            ],
            data: {}
        };
    }
    else if (error instanceof Error)
    {
        telemetryClient.trackException({
            exception: error,
            severity: 3
        });
        return {
            status: 500,
            errors: [
                {
                    errorType: error.name,
                    message: error.message
                }
            ],
            data: {}
        };
    }
    else
    {
        telemetryClient.trackException({
            exception: error,
            severity: 3
        });
        return {
            status: 500,
            errors: [
                {
                    errorType: 'UnknownError',
                    message: error.toString()
                }
            ],
            data: {}
        };
    }
}

module.exports = formatErrorMessageStructure;