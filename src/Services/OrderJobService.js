const OrderStopLink = require('../Models/OrderStopLink');
const OrderStop = require('../Models/OrderStop');
const Commodity = require('../Models/Commodity');
const OrderJob = require('../Models/OrderJob');
const { pickBy } = require('ramda');

class OrderJobService
{
    static async bulkUpdateUsers({ jobs = [], dispatcher = undefined })
    {
        const results = {};

        // additional fields can be added here
        const payload =
        {
            dispatcherGuid: dispatcher
        };

        // remove and check for undefineds
        const cleaned = pickBy((it) => it !== undefined, payload);

        if (Object.keys(cleaned).length === 0)
            throw { 'status': 400, 'data': 'Missing Update Values' };

        const promises = await Promise.allSettled(jobs.map(async (job) =>
        {
            // need to throw and catch in order to be able to return the guid for mapping of errors
            const res = await OrderJob.query().findById(job).patch(payload).returning('guid')
                .catch((err) => { throw { 'guid': job, 'data': err }; });

            return { 'guid': job, 'data': res };
        }));

        for (const e of promises)
        {
            if (e.reason)
                results[e.reason.guid] = { 'error': e.reason.data, 'status': 400 };
            else if (e.value?.data == undefined || e.value.data == 0)
                results[e.value.guid] = { 'error': 'Job Not Found', 'status': 404 };
            else
                results[e.value.guid] = { 'status': 200 };
        }

        return results;
    }

    /**
     *  Returns a promise that will delete the commodities and all that Jazz from the Job.
     * @param {String} orderGuid
     * @param {String} jobGuid
     * @param {String[]} commodities
     * @param {Transaction} trx
     * @returns
     */
    static deleteCommodities(orderGuid, jobGuid, commodities, trx)
    {
        return OrderStopLink.query(trx)
            .whereIn('commodityGuid', commodities)
            .where('jobGuid', jobGuid)
            .where('orderGuid', orderGuid)
            .delete()
            .returning('stopGuid')
            .then((deletedStopLinks) =>
            {
                const stopGuids = [... new Set(deletedStopLinks.map(it => it.stopGuid))];

                if (deletedStopLinks.length > 0)
                {
                    // if the commodity only exists for the order, delete the commodity
                    const deleteLooseOrderStopLinks = [];
                    for (const stopGuid of stopGuids)
                    {
                        deleteLooseOrderStopLinks.push(
                            OrderStopLink.query(trx)
                                .whereIn('commodityGuid', commodities)
                                .where('orderGuid', orderGuid)
                                .where('stopGuid', stopGuid)
                                .whereNull('jobGuid')
                                .whereNotExists(
                                    OrderStopLink.query(trx)
                                        .whereIn('commodityGuid', commodities)
                                        .where('stopGuid', stopGuid)
                                        .where('orderGuid', orderGuid)
                                        .whereNotNull('jobGuid'))
                                .delete()
                        );
                    }

                    return Promise.all([
                        Commodity.query(trx)
                            .whereIn('guid', commodities)
                            .whereNotExists(
                                OrderStopLink.query(trx)
                                    .whereIn('commodityGuid', commodities)
                                    .where('orderGuid', orderGuid)
                                    .whereNotNull('jobGuid'))
                            .delete(),
                        Promise.all(deleteLooseOrderStopLinks)
                    ]).then((numDeletes) =>
                    {
                        console.log('deleted commodities: ', numDeletes);

                        // if the there is a stop that is not attached to an order, delete the stop
                        return OrderStop.query(trx)
                            .whereIn('guid', stopGuids)
                            .whereNotIn('guid', OrderStopLink.query(trx).select('stopGuid'))
                            .delete();
                    });
                }
            });
    }
}

module.exports = OrderJobService;