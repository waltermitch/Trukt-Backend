const {
    ValidationError: ObjectionValidationError,
    NotFoundError: ObjectionNotFoundError,
    DBError,
    ConstraintViolationError,
    UniqueViolationError,
    NotNullViolationError,
    ForeignKeyViolationError,
    CheckViolationError,
    DataError
} = require('objection');
const ValidationError = require('./Exceptions/ValidationError');
const ApiError = require('./Exceptions/ApiError');
const AuthenticationError = require('./Exceptions/AuthenticationError');
const DataConflictError = require('./Exceptions/DataConflictError');
const MissingDataError = require('./Exceptions/MissingDataError');
const NotAllowedError = require('./Exceptions/NotAllowedError');
const NotFoundError = require('./Exceptions/NotFoundError');
const ApplicationError = require('./Exceptions/ApplicationError');

const OpenApiValidatorErrorTypes = require('express-openapi-validator').error;
const telemetryClient = require('./Insights');
const { SeverityLevel } = require('applicationinsights/out/Declarations/Contracts');

/**
 * Evaluates the error and returns the appropriate error message structure, also the error is logged to Azure App Insights.
 * @param {unknown} error - The error to evaluate.
 * @returns {{status: number, errors: {errorType: string, message: string, code?: number | string}[], data?: Record<string, unknown} | {message: string}}
 */
function formatErrorMessageStructure(error)
{
    if (error instanceof ObjectionValidationError)
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
                    severity: SeverityLevel.Warning
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
    else if (error instanceof ObjectionNotFoundError)
    {
        telemetryClient.trackException({
            exception: error,
            severity: SeverityLevel.Warning
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
            severity: SeverityLevel.Error
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
            severity: SeverityLevel.Critical
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
    else if (
        error instanceof ApiError
        || error instanceof AuthenticationError
        || error instanceof DataConflictError
        || error instanceof MissingDataError
        || error instanceof NotAllowedError
        || error instanceof NotFoundError
        || error instanceof ValidationError
    )
    {
        const { status, ...errorMessage } = error.toJSON();
        telemetryClient.trackException({
            exception: error,
            severity: SeverityLevel.Warning
        });
        
        return {
            status,
            errors: [errorMessage]
        };
    }
    else if (error.constructor?.name in OpenApiValidatorErrorTypes)
    {
        telemetryClient.trackException({
            exception: error,
            severity: SeverityLevel.Warning
        });
        return {
            status: 400,
            errors: error.errors?.length > 0 ? error.errors : [
                {
                    errorType: error.constructor.name,
                    message: error.message
                }
            ]
        };
    }
    else if (error instanceof ApplicationError)
    {
        const { status, ...errorMessage } = error.toJSON();
        
        telemetryClient.trackException({
            exception: error,
            severity: SeverityLevel.Error
        });
        
        return {
            status,
            errors: [errorMessage]
        };
    }
    else
    {
        let errorMessage = '';
        if (error?.message)
            errorMessage = error.message;
        else if (typeof error === 'string')
            errorMessage = error;
        else
            errorMessage = JSON.stringify(error);

        telemetryClient.trackException({
            exception: error,
            severity: SeverityLevel.Error
        });
        return {
            status: 500,
            errors: [
                {
                    errorType: error.constructor?.name ?? 'UnknownError',
                    message: errorMessage,
                    ...(['local', 'dev', 'development'].includes(process.env.NODE_ENV) ? { stack: error.stack } : {})
                }
            ]
        };
    }
}

module.exports = formatErrorMessageStructure;