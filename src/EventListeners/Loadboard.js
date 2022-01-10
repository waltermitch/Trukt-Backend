const listener = require('./index');
const LoadboardService = require('../Services/LoadboardService');
const PubSubService = require('../Services/PubSubService');

listener.on('orderjob_dispatch_offer_sent', async ({ jobGuid }) =>
{
    const jobPayload = await LoadboardService.getJobDispatchData(jobGuid);
    const proms = await Promise.allSettled([PubSubService.jobUpdated(jobGuid, jobPayload)]);

    // for (const p of proms)
    //     if (p.status === 'rejected')
    //         console.log(p.reason?.response?.data || p.reason);
});

listener.on('orderjob_dispatch_offer_canceled', async ({ jobGuid }) =>
{
    const jobPayload = await LoadboardService.getJobDispatchData(jobGuid);
    const proms = await Promise.allSettled([PubSubService.jobUpdated(jobGuid, jobPayload)]);

    // for (const p of proms)
    //     if (p.status === 'rejected')
    //         console.log(p.reason?.response?.data || p.reason);
});

module.exports = listener;