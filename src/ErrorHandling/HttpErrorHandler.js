const { SeverityLevel } = require('applicationinsights/out/Declarations/Contracts');
const BulkResponse = require('./Responses/BulkResponse');
const AppResponse = require('./Responses/AppResponse');
const formatErrorMessageStructure = require('./FormatErrorMessageStructure');
const telemetryClient = require('./Insights');

module.exports = (errors, request, response, next) =>
{
    if (
        errors instanceof BulkResponse
        || (errors?.onlySendErrorsToTelemetry && errors?.instance instanceof BulkResponse)
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
    else if (errors instanceof AppResponse || Array.isArray(errors))
    {
        const errorsException = Array.isArray(errors)
            ? new AppResponse(errors)
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
