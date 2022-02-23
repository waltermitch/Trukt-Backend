const { SeverityLevel } = require('applicationinsights/out/Declarations/Contracts');
const BulkException = require('./Exceptions/BulkException');
const ExceptionCollection = require('./Exceptions/ExceptionCollection');
const formatErrorMessageStructure = require('./FormatErrorMessageStructure');
const telemetryClient = require('./Insights');

module.exports = (errors, request, response, next) =>
{
    if (
        errors instanceof BulkException
        || (errors?.onlySendErrorsToTelemetry && errors?.instance instanceof BulkException)
    )
    {
        const exception = errors?.onlySendErrorsToTelemetry ? errors.instance : errors;

        telemetryClient.trackException({
            exception: exception,
            severity: SeverityLevel.Error
        });
        
        if (errors?.onlySendErrorsToTelemetry) return;

        response.status(200).json(errors.toJSON());
    }
    else if (errors instanceof ExceptionCollection || Array.isArray(errors))
    {
        const errorsException = Array.isArray(errors)
            ? new ExceptionCollection(errors)
            : errors;
        const formattedErrors = errorsException.toJSON();

        telemetryClient.trackException({
            exception: errorsException,
            severity: SeverityLevel.Error
        });
        
        response.status(formattedErrors.status).send(formattedErrors);
    }
    else
    {
        const errorMessage = formatErrorMessageStructure(errors);

        response.status(errorMessage.status).send(errorMessage);
    }
};
