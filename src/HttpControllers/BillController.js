const BillService = require('../Services/BillService');

class BillController
{
    static async getBill(req, res)
    {
        const result = await BillService.getBill(req.params.billGuid);
        if (result)
        {
            res.status(200);
            res.json(result);
        }
        else
        {
            res.status(404);
            res.send();
        }
    }

    static async exportBill(req, res)
    {
        const orders = [req.params.orderGuid];

        const result = (await BillService.exportBills(orders))?.[0];

        if (result)
        {
            if (result.error)
                res.status(400);
            else
                res.status(200);

            res.json(result);
        }
        else
        {
            res.status(404);
            res.json({ 'error': 'Order Not Found' });
        }
    }

    static async exportBills(req, res)
    {
        const orders = req.body?.orders;

        if (!orders || orders == 0)
        {
            res.status(400);
            res.json({ 'error': 'Missing Or Empty Array' });
        }
        else
        {
            const result = await BillService.exportBills(orders);

            if (result)
            {
                res.status(200);
                res.json(result);
            }
            else
            {
                res.status(404);
                res.json({ 'error': 'Order Not Found' });
            }
        }
    }
}

module.exports = BillController;