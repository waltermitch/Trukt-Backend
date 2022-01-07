const PubSub = require('../Azure/PubSub');
const OrderJobDispatch = require('../Models/OrderJobDispatch');
const PicklistService = require('./PicklistService');
const knex = require('../Models/BaseModel').knex();

class PubSubService
{
    // use this method to propogate job updates
    // currently we are only passing in the status and the user who updated the job
    // eventually we should be passing the whole Order/OrderJob object
    static async jobUpdated(jobGuid, payload)
    {
        if (!jobGuid)
            throw new Error('jobGuid is required to publish to job updates to pubsub');
        else if (Object.keys(payload).length === 0)
            throw new Error('non-empty payload is required to publish to job updates to pubsub, received: ' + JSON.stringify(payload));

        const data =
        {
            'object': 'job',
            'data': payload
        };

        await PubSub.publishToGroup(jobGuid, data);
    }

    static async jobActivityUpdate(jobGuid, payload)
    {
        if (!jobGuid)
            throw new Error('jobGuid is required to publish to job updates to pubsub');
        else if (Object.keys(payload).length === 0)
            throw new Error('non-empty payload is required to publish to job updates to pubsub, received: ' + JSON.stringify(payload));

        const data =
        {
            'object': 'activity',
            'data': payload
        };

        await PubSub.publishToGroup(jobGuid, data);
    }

    static async jobDispatchUpdate(jobGuid, sentOfferOrAccepted)
    {
        let job;
        if (sentOfferOrAccepted)
        {

            job = await OrderJobDispatch.query()
                .withGraphJoined('[vendor, vendorAgent]')
                .modifyGraph('vendor', builder =>
                {
                    builder.select(
                        'dotNumber',
                        'email',
                        'phoneNumber',
                        'billingStreet',
                        'billingCity',
                        'billingPostalCode',
                        'billingState',
                        'billingCountry');
                })
                .modifyGraph('vendorAgent', builder =>
                {
                    builder.select(
                        'name',
                        'email',
                        'phoneNumber');
                })
                .leftJoinRelated('job')
                .select(
                    'orderJobDispatches.guid as dispatchGuid',
                    'job.guid as jobGuid',
                    'job.status'
                ).findOne({ 'jobGuid': jobGuid, isValid: true })
                .andWhere(builder => builder.where({ isPending: true }).orWhere({
                    isAccepted: true
                }));

            // we need to get the stops that are associated with this dispatch
            // and since jobs and stops have a weird relationship, it is easier to do
            // a raw query that gets the data.
            const stops = (await knex.raw(`
                            select distinct(os.guid), os.stop_type, os.date_scheduled_type, os.date_scheduled_start, os.date_scheduled_end, os.sequence
                            from rcg_tms.order_job_dispatches ojd 
                            left join rcg_tms.order_stop_links osl 
                            on ojd.job_guid = osl.job_guid
                            left join rcg_tms.order_stops os 
                            on osl.stop_guid = os.guid 
                            where ojd.guid = ?
                            and (os.stop_type = 'pickup' or os.stop_type = 'delivery')
                            and os.date_scheduled_type is not null order by os.sequence;`, [job.dispatchGuid])).rows;

            // postgres does not do camel case so we need to transform all the keys
            // to camel case
            for (const stop of stops)
            {
                for (const key of Object.keys(stop))
                {
                    const k = PicklistService.cleanUpSnakeCase(key);
                    if (k == key)
                        continue;
                    stop[k] = stop[key];
                    delete stop[key];
                }
            }

            job.pickup = stops[0];
            job.delivery = stops[1];
        }
        else
        {
            job = (await OrderJobDispatch.query()
                .leftJoinRelated('job')
                .select(
                    'job.guid as jobGuid',
                    'job.status'
                ).where({ 'jobGuid': jobGuid })
                .andWhere(builder =>
                    builder.where({ 'orderJobDispatches.isCanceled': true })
                        .orWhere({ isDeclined: true }))
                .limit(1))[0];
            if (job)
            {
                job.vendor = {
                    dotNumber: null,
                    email: null,
                    phone: null,
                    billingStreet: null,
                    billingCity: null,
                    billingPostalCode: null,
                    billingState: null,
                    billingCountry: null
                };
                job.vendorAgent = {
                    name: null,
                    email: null,
                    phone: null
                };
                job.pickup = { datedScheduledType: null, dateScheduledStart: null, dateScheduledEnd: null };
                job.delivery = { datedScheduledType: null, dateScheduledStart: null, dateScheduledEnd: null };
            }
        }
        console.log(job);
        await PubSub.publishToGroup(jobGuid, { object: 'dispatch', data: { job } });
    }
}

module.exports = PubSubService;