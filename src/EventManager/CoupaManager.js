const OrderService = require('../Services/OrderService');
const Queue = require('../Azure/ServiceBus');

class CoupaManager
{
    static async checkCoupaQueue()
    {
        // poll the coupapos queue for new messages (50 at a time)
        const res = await Queue.popMany('coupapos', 50);

        const proms = [];

        // for each message
        for (const msg of res)
            if (msg !== undefined)

                // add to promise array
                proms.push({ func: CoupaManager.updatePO, params: [msg.po, msg.vin] });

        // wait for all promises to complete
        await Promise.allSettled(proms.map(p => p.func(...p.params)));
    }

    static async updatePO(po, vin)
    {
        // find order by vin
        const orders = await OrderService.findByVin(vin);

        if (orders.length === 0)
            return;

        // other wise update top order
        const order = orders[0];

        const payload =
        {
            'guid': order.guid,
            'referenceNumber': po
        };

        // send update to order service
        await OrderService.patchOrder(payload);
    }
}

module.exports = CoupaManager;