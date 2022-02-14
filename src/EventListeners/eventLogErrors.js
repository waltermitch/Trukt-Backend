const { ApplicationError } = require('../ErrorHandling/Exceptions');
const telemetryClient = require('../ErrorHandling/Insights');

/**
 * @param {PromiseSettledResult[]} proms
 */
function eventLogErrors(proms, eventName = 'unknown')
{

    if (proms.some((prom) => prom.status === 'rejected'))
    {
        telemetryClient.trackException({
            exception: new ApplicationError(`${eventName} event failed`),
            severity: 3,
            properties: {
                eventName,
                failedPromises: proms
                    .filter((prom) => prom.status === 'rejected')
                    .map((prom) => prom.reason?.response?.data || prom.reason)
            }
        });

        // for (const p of proms)
        //     if (p.status === 'rejected')
        //         console.log(p.reason?.response?.data || p.reason);
    }
}

module.exports = eventLogErrors;