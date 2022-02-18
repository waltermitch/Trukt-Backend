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
 * Evaluates the error and returns the appropriate error message structure.
 * @param {Record<string, string | number | string[]} error - The error to return if is not collection.
 * @param {boolean} isCollection - Whether the error is evaluated inside a collection.
 * @param {Record<string, string | number} collectionErrorMessage - The error message structure to return if the error is evaluated inside a collection.
 * @returns {error | collectionErrorMessage} The error message structure to return.
 */
function responseObjectToReturn(error, isCollection, collectionErrorMessage = {})
{
    if (isCollection)
        return collectionErrorMessage;

    return error;
}

/**
 * Evaluates the error and returns the appropriate error message structure, also the error is logged to Azure App Insights.
 * @param {unknown} error - The error to evaluate.
 * @param {boolean} isCollection - Whether the error is evaluated inside a collection.
 * @returns {{status: number, errors: {errorType: string, message: string, code?: number | string}[], data?: Record<string, unknown} | {message: string}}
 */
function formatErrorMessageStructure(error, isCollection = false)
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
                if (!isCollection)
                    telemetryClient.trackException({
                        exception: error,
                        severity: SeverityLevel.Warning
                    });
                return responseObjectToReturn({
                    status: 400,
                    errors: [
                        {
                            errorType: error.type,
                            message: error.message
                        }
                    ],
                    data: error.data
                }, isCollection, {
                    message: error.message
                });
        }
    }
    else if (error instanceof ObjectionNotFoundError)
    {
        if (!isCollection)
            telemetryClient.trackException({
                exception: error,
                severity: SeverityLevel.Warning
            });
        return responseObjectToReturn({
            status: 404,
            errors: [
                {
                    errorType: error.name,
                    message: error.message
                }
            ],
            data: error.data
        },
        isCollection,
        {
            message: error.message
        });
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
        if (!isCollection)
            telemetryClient.trackException({
                exception: error,
                severity: SeverityLevel.Error
            });
        return responseObjectToReturn({
            status: 500,
            errors: [
                {
                    errorType: error.name,
                    message: error.nativeError.detail,
                    code: error.nativeError.code
                }
            ],
            data: error.data
        },
        isCollection,
        {
            message: error.nativeError.detail,
            code: error.nativeError.code
        });
    }
    else if (error instanceof DBError)
    {
        if (!isCollection)
            telemetryClient.trackException({
                exception: error,
                severity: SeverityLevel.Critical
            });
        return responseObjectToReturn({
            status: 500,
            errors: [
                {
                    errorType: error.name,
                    message: error.message
                }
            ],
            data: error.data
        },
        isCollection,
        {
            message: error.message
        });
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
        if (!isCollection)
            telemetryClient.trackException({
                exception: error,
                severity: SeverityLevel.Warning
            });
        
        return responseObjectToReturn({
            status,
            errors: [errorMessage]
        },
        isCollection,
        {
            message: errorMessage.message
        });
    }
    else if (error.constructor?.name in OpenApiValidatorErrorTypes)
    {
        telemetryClient.trackException({
            exception: error,
            severity: SeverityLevel.Warning
        });
        return responseObjectToReturn({
            status: 400,
            errors: error.errors?.length > 0 ? error.errors : [
                {
                    errorType: error.constructor.name,
                    message: error.message
                }
            ]
        }, false);
    }
    else if (error instanceof ApplicationError)
    {
        const { status, ...errorMessage } = error.toJSON();
        
        if (!isCollection)
            telemetryClient.trackException({
                exception: error,
                severity: SeverityLevel.Error
            });
        
        return responseObjectToReturn({
            status,
            errors: [errorMessage]
        },
        isCollection,
        {
            message: errorMessage.message
        });
    }
    else
    {
        const errorMessage = error?.message ?? JSON.stringify(error);

        if (!isCollection)
            telemetryClient.trackException({
                exception: error,
                severity: SeverityLevel.Error
            });
        return responseObjectToReturn({
            status: 500,
            errors: [
                {
                    errorType: error.constructor?.name ?? 'UnknownError',
                    message: errorMessage
                }
            ]
        },
        isCollection,
        {
            message: errorMessage
        });
    }
}

module.exports = formatErrorMessageStructure;