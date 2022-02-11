const formatErrorMessageStructure = require('./FormatErrorMessageStructure');

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
    else
    {
        const errorMessage = formatErrorMessageStructure(errors);

        response.status(errorMessage.status).send(errorMessage);
    }
};
