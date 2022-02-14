const BulkException = require('./Exceptions/BulkException');
const ExceptionCollection = require('./Exceptions/ExceptionCollection');
const formatErrorMessageStructure = require('./FormatErrorMessageStructure');
const telemetryClient = require('./Insights');

module.exports = (errors, request, response, next) =>
{

    if (errors instanceof BulkException)
    {
        telemetryClient.trackException({
            exception: errors,
            severity: 3
        });
        
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
            severity: 3
        });
        
        response.status(formattedErrors.status).send(formattedErrors);
    }
    else
    {
        const errorMessage = formatErrorMessageStructure(errors);

        response.status(errorMessage.status).send(errorMessage);
    }
};
