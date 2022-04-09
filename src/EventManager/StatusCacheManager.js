const OrderJob = require('../Models/OrderJob');

// cache that will store aggregate of status
const cache = {
    'transport': {
        'active': null,
        'new': null,
        'tender': null,
        'onHold': null,
        'ready': null,
        'posted': null,
        'request': null,
        'pending': null,
        'declined': null,
        'dispatched': null,
        'pickedUp': null,
        'completed': null,
        'delivered': null,
        'canceled': null,
        'deleted': null
    },
    'service': {
        'active': null,
        'new': null,
        'onHold': null,
        'ready': null,
        'inProgress': null,
        'completed': null,
        'canceled': null,
        'deleted': null
    }

};

class StatusCacheManager
{
    // maping of all status counters
    static statusMap = {
        'active': 'statusActive',
        'new': 'statusNew',
        'tender': 'statusTender',
        'onHold': 'statusOnHold',
        'ready': 'statusReady',
        'posted': 'statusPosted',
        'request': 'statusRequests',
        'pending': 'statusPending',
        'declined': 'statusDeclined',
        'dispatched': 'statusDispatched',
        'pickedUp': 'statusPickedUp',
        'delivered': 'statusDelivered',
        'canceled': 'statusCanceled',
        'deleted': 'statusDeleted',
        'completed': 'statusComplete',
        'inProgress': 'statusInProgress'
    }

    // just to make sure the cache object exists
    static startCache()
    {
        return cache;
    }

    // method that will aggregate jobs per it's status
    static async updateStatus()
    {
        const trx = await OrderJob.transaction();
        try
        {

            // array to fire off all request at same time
            const promiseArray = [];
            for (const type of ['transport', 'service'])
            {
                const jobType = type + 'Job';

                // looping through status map and applying rquires query
                for (const [status] of Object.entries(cache[type]))
                {
                    promiseArray.push(OrderJob.query(trx).alias('job').modify([StatusCacheManager.statusMap[status], jobType]).resultSize().then((value) => cache[type][status] = value));
                }
            }

            // executing all requests
            await Promise.allSettled(promiseArray);
            await trx.commit();
        }
        catch (error)
        {
            await trx.rollback();
            throw error;
        }

    }

    // method to return updated cache
    static async returnUpdatedCache()
    {
        // check if cache has null values, that means it reset
        if (Object.values(cache.transport).includes(null))
        {
            // running calulate function to update values
            await StatusCacheManager.updateStatus();
        }

        // return cache
        return cache;
    }

    // pubsub method
}

module.exports = StatusCacheManager;