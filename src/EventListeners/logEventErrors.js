const { SeverityLevel } = require('applicationinsights/out/Declarations/Contracts');
const { ApplicationError } = require('../ErrorHandling/Exceptions');
const telemetryClient = require('../ErrorHandling/Insights');

/**
 * @param {PromiseSettledResult[]} errors
 */
function logEventErrors(errors, eventName = 'unknown')
{

    if (Array.isArray(errors) && errors.some((prom) => prom.status === 'rejected'))
    {
        telemetryClient.trackException({
            exception: new ApplicationError(`${eventName} event failed`),
            severity: SeverityLevel.Error,
            properties: {
                eventName,
                failedPromises: errors
                    .filter((prom) => prom.status === 'rejected')
                    .map((prom) => prom.reason?.response?.data || prom.reason)
            }
        });

        // for (const p of proms)
        //     if (p.status === 'rejected')
        //         console.log(p.reason?.response?.data || p.reason);
    }
    else if (errors instanceof Error)
    {
        telemetryClient.trackException({
            exception: errors,
            severity: SeverityLevel.Error,
            properties: {
                eventName
            }
        });
    }
}

module.exports = logEventErrors;