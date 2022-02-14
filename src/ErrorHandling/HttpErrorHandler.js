const ExceptionCollection = require('./Exceptions/ExceptionCollection');
const formatErrorMessageStructure = require('./FormatErrorMessageStructure');
const telemetryClient = require('./Insights');

module.exports = (errors, request, response, next) =>
{

    if (Array.isArray(errors))
    {
        // TODO: Set error exception in Application Azure Insights with the class designated for bulk actions

        response.status(200).send({
            status: 200,
            errors: errors.map(formatErrorMessageStructure)
        });
    }
    else if (errors instanceof ExceptionCollection)
    {
        const formattedErrors = errors.toJSON();

        telemetryClient.trackException({
            exception: errors,
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
