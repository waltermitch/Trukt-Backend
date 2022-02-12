const EDIData = require('../Models/EDIData');
const Order = require('../Models/Order');
const OrderStop = require('../Models/OrderStop');
const EDI214Payload = require('../EDI/Payload/EDI214Payload');
const EDIConfig = require('../EDI/EDIConfig');
const EDIApi = require('../EDI/EDIApi');
const { DateTime } = require('luxon');
const telemetry = require('../ErrorHandling/Insights');
const { SeverityLevel } = require('applicationinsights/out/Declarations/Contracts');

class EDIService
{

    /**
     * @description Returns an promise that will send the code to the EDI system
     * @param {Object{order: Order, job: OrderJob, stop: OrderStop}} params
     * @param {String} code
     */
    static async sendCode({ order, job, stop, datetime }, code)
    {
        // First check if this is an EDI order
        return EDIData.query().findOne({ orderGuid: order.guid, documentNumber: '204' })
            .then(async (edi204doc) =>
            {
                if (edi204doc)
                {
                    // Process the Order and send the EDI api updates
                    /* eslint-disable array-element-newline */
                    const [
                        commodities,
                        stopRec,

                        // This is needed for Agistix, they require the pickup date when sending the 214 status updates
                        pickupRec,
                        orderRec
                    ] = await Promise.all(
                        [
                            OrderStop.relatedQuery('commodities').for(stop.guid).distinctOn('guid'),
                            OrderStop.query().withGraphJoined('terminal').findById(stop.guid),
                            Order.relatedQuery('stops').for(order.guid).findOne('stopType', 'pickup').orderBy('sequence', 'asc'),
                            Order.query().findById(order.guid).withGraphJoined('client')
                        ]);
                    const client = orderRec.client;

                    if (client.isEDIClient() && EDIConfig.accepts214StatusCode(client, code))
                    {
                        const payload = new EDI214Payload();
                        payload.addOrder(orderRec);
                        payload.addPartner(client);
                        payload.addLocation(stopRec.terminal);
                        payload.addStatus(code);
                        payload.addReason('NS');
                        payload.addEDIData(edi204doc);
                        payload.addDatetime(datetime);
                        payload.addCommodities(commodities);
                        payload.addPickupStop(pickupRec);

                        await EDIApi.send214(payload).catch(EDIApi.handleError);
                    }
                }
            });

    }

    /**
     * This function will retrieve Orders that have commodities which are "en route" to a delivery location
     * The Order must be a non-completed, non-deleted, ready state order.
     */
    static async notifyEDIPartnerEnrouteOrders()
    {
        const limit = 10;
        const offset = 0;

        // If you are a ObjectionJS wizard, you can convert this query with joins.
        const enrouteOrdersQuery = ` 
        select distinct on (os2.guid)
            o.actual_expense as "order:actual_expense",
            o.actual_income as "order:actual_income",
            o.actual_revenue as "order:actual_revenue",
            o.bol as "order:bol",
            o.bol_url as "order:bol_url",
            o.client_contact_guid as "order:client_contact_guid",
            o.client_guid as "order:client_guid",
            o.client_notes as "order:client_notes",
            o.created_by_guid as "order:created_by_guid",
            o.date_completed as "order:date_completed",
            o.date_created as "order:date_created",
            o.date_deleted as "order:date_deleted",
            o.date_expected_complete_by as "order:date_expected_complete_by",
            o.date_updated as "order:date_updated",
            o.date_verified as "order:date_verified",
            o.deleted_by_guid as "order:deleted_by_guid",
            o.dispatcher_guid as "order:dispatcher_guid",
            o.distance as "order:distance",
            o.estimated_distance as "order:estimated_distance",
            o.estimated_expense as "order:estimated_expense",
            o.estimated_income as "order:estimated_income",
            o.estimated_revenue as "order:estimated_revenue",
            o.gross_profit_margin as "order:gross_profit_margin",
            o.guid as "order:guid",
            o.inspection_type as "order:inspection_type",
            o.instructions as "order:instructions",
            o.is_canceled as "order:is_canceled",
            o.is_complete as "order:is_complete",
            o.is_deleted as "order:is_deleted",
            o.is_dummy as "order:is_dummy",
            o.is_on_hold as "order:is_on_hold",
            o.is_ready as "order:is_ready",
            o.is_tender as "order:is_tender",
            o.number as "order:number",
            o.quoted_revenue as "order:quoted_revenue",
            o.reference_number as "order:reference_number",
            o.referrer_guid as "order:referrer_guid",
            o.salesperson_guid as "order:salesperson_guid",
            o.status as "order:status",
            o.updated_by_guid as "order:updated_by_guid",
            o.verified_by_guid as "order:verified_by_guid",
            os2.alternative_contact_guid as "stop:alternative_contact_guid",
            os2.created_by_guid as "stop:created_by_guid",
            os2.date_completed as "stop:date_completed",
            os2.date_created as "stop:date_created",
            os2.date_deleted as "stop:date_deleted",
            os2.date_estimated_end as "stop:date_estimated_end",
            os2.date_estimated_start as "stop:date_estimated_start",
            os2.date_estimated_type as "stop:date_estimated_type",
            os2.date_requested_end as "stop:date_requested_end",
            os2.date_requested_start as "stop:date_requested_start",
            os2.date_requested_type as "stop:date_requested_type",
            os2.date_scheduled_end as "stop:date_scheduled_end",
            os2.date_scheduled_start as "stop:date_scheduled_start",
            os2.date_scheduled_type as "stop:date_scheduled_type",
            os2.date_started as "stop:date_started",
            os2.date_updated as "stop:date_updated",
            os2.deleted_by_guid as "stop:deleted_by_guid",
            os2.guid as "stop:guid",
            os2.is_completed as "stop:is_completed",
            os2.is_deleted as "stop:is_deleted",
            os2.is_started as "stop:is_started",
            os2.notes as "stop:notes",
            os2.primary_contact_guid as "stop:primary_contact_guid",
            os2.sequence as "stop:sequence",
            os2.status as "stop:status",
            os2.stop_type as "stop:stop_type",
            os2.terminal_guid as "stop:terminal_guid",
            os2.updated_by_guid as "stop:updated_by_guid"
        from 
        rcg_tms.order_stop_links osl 
            left join rcg_tms.order_stops os 
            on osl.stop_guid = os.guid,
        rcg_tms.order_stop_links osl2
            left join rcg_tms.order_stops os2
            on osl2.stop_guid = os2.guid 
            left join rcg_tms.orders o
            on osl2.order_guid = o.guid
            inner join rcg_tms.edi_data edi
            on edi.order_guid = o.guid
        where 
            os.stop_type = 'pickup'
            and os.is_completed = true
            and os2.stop_type = 'delivery'
            and os2.is_started = false
            and osl.order_guid = osl2.order_guid
            and osl.job_guid is null 
            and osl2.job_guid is null
            and osl.commodity_guid = osl2.commodity_guid
            and o.is_deleted = false
            and o.is_canceled = false
            and o.is_ready = true
            and o.is_dummy = false
            and o.is_complete = false
        `;

        const totalRows = await Order.knex().raw(`
            select count(res.*) from (
                ${enrouteOrdersQuery}
            ) as res;
        `).then((result) => result.rows[0].count);

        const pages = Math.ceil(totalRows / limit);
        const ediReqs = [];
        for (let i = 0; i < pages; i++)
        {
            // paginate the results so we dont bog down the server
            const rows = await Order.knex().raw(
                `select * from (
                    ${enrouteOrdersQuery}
                ) as t
                order by 
                    t."order:date_created"
                limit ${limit}
                offset ${i * offset}`
            ).then((result) => result.rows);

            for (const row of rows)
            {
                const orderJson = {};
                const stopJson = {};
                for (const key of Object.keys(row))
                {
                    // cleaning up the returned Knex results so that they work with ObjectionJS
                    if (/^order:/.test(key))
                    {
                        orderJson[key
                            .replace(/^order:/, '')
                            .replace(/_(\w)/g, (string, ...args) =>
                            {
                                return args[0].toUpperCase();
                            })] = row[key];
                    }
                    else if (/^stop:/.test(key))
                    {
                        stopJson[key
                            .replace(/^stop:/, '')
                            .replace(/_(\w)/g, (string, ...args) =>
                            {
                                return args[0].toUpperCase();
                            })] = row[key];

                    }
                }
                const params = {
                    order: Order.fromJson(orderJson),
                    stop: OrderStop.fromJson(stopJson),
                    datetime: DateTime.now(),

                    // for verbosity
                    job: null
                };

                ediReqs.push(
                    EDIService
                        .sendCode(params, 'X6')
                        .catch((error) =>
                        {
                            telemetry.trackException(
                                {
                                    exception: error,
                                    properties: params,
                                    severity: SeverityLevel.Error
                                }
                            );
                        })
                );
            }

            // returned errors will be tracked in application insights.
            await Promise.allSettled(ediReqs);
        }
    }
}

module.exports = EDIService;