const listener = require('./index');
const PubSubService = require('../Services/PubSubService');

listener.on('orderjob_dispatch_offer_sent_or_accepted', async ({ jobGuid, dispatchGuid }) =>
{
    const proms = await Promise.allSettled([PubSubService.jobDispatchUpdate(jobGuid, true)]);

    // for (const p of proms)
    //     if (p.status === 'rejected')
    //         console.log(p.reason?.response?.data || p.reason);
});

listener.on('orderjob_dispatch_offer_canceled_or_declined', async ({ jobGuid, dispatchGuid }) =>
{
    const proms = await Promise.allSettled([PubSubService.jobDispatchUpdate(jobGuid, false)]);

    // for (const p of proms)
    //     if (p.status === 'rejected')
    //         console.log(p.reason?.response?.data || p.reason);
});

module.exports = listener;