const EDIData = require('../Models/EDIData');
const Order = require('../Models/Order');
const OrderStop = require('../Models/OrderStop');
const EDI214Payload = require('../EDI/Payload/EDI214Payload');
const EDIConfig = require('../EDI/EDIConfig');
const EDIApi = require('../EDI/EDIApi');

class EDIService
{

    /**
     * @description Returns an promise that will send the code to the EDI system
     * @param {Object{order: Order, job: OrderJob, stop: OrderStop}} params
     * @param {String} code
     */
    static async sendCode({ order, job, stop }, code)
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
                        orderRec
                    ] = await Promise.all(
                        [
                            OrderStop.relatedQuery('commodities').for(stop.guid).distinctOn('guid'),
                            OrderStop.query().withGraphJoined('terminal').findById(stop.guid),
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
                        payload.addDatetime(stopRec.dateScheduledStart);
                        payload.addCommodities(commodities);

                        const res = await EDIApi.send214(payload);
                    }
                }
            });

    }
}

module.exports = EDIService;