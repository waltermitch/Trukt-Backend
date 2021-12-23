const LoadboardService = require('../Services/LoadboardService');
const OrderJob = require('../Models/OrderJob');
const { EventEmitter } = require('events');

const listener = new EventEmitter();

listener.on('order_updated', ({ oldOrder, newOrder }) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([newOrder.jobs.map(async (job) => await LoadboardService.updatePostings(job.guid).catch(err => console.log(err)))]);

        // for (const p of proms)
        //     if (p.status === 'rejected')
        //         console.log(p.reason?.response?.data || p.reason);
    });
});

listener.on('order_client_notes_updated', (orderGuid) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([getJobGuids(orderGuid).then(jobGuids => jobGuids.map(jobGuid => LoadboardService.updatePostings(jobGuid.guid)))]);

        // for (const p of proms)
        //     if (p.status === 'rejected')
        //         console.log(p.reason?.response?.data || p.reason);
    });
});

async function getJobGuids(orderGuid)
{
    const jobs = await OrderJob.query().select('guid').where('orderGuid', orderGuid);

    return jobs;
}