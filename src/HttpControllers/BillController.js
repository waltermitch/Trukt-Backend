const BillService = require('../Services/BillService');

class BillController
{
    static async getBill(req, res)
    {
        const result = await BillService.getBill(req.params.billId);

        res.status(200);
        res.json(result);
    }

    static async exportBill(req, res)
    {
        const orders = [req.params.orderGuid];

        const result = await BillService.exportBills(orders);

        res.status(200);
        res.json(result);
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

            res.status(200);
            res.json(result);
        }
    }
}

module.exports = BillController;