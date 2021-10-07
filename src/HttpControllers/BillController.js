const BillService = require('../Services/BillService');

class BillController
{
    static async getBill(req, res)
    {
        const result = await BillService.getBill(req.params.billId);

        res.status(200);
        res.json(result);
    }

    static async createBills(req, res)
    {
        const jobs = req.body?.jobs;

        if (!jobs || jobs == 0)
        {
            res.status(400);
            res.json({ 'error': 'Missing Or Empty Array' });
        }
        else
        {
            const result = await BillService.createBills(jobs);

            res.status(200);
            res.json(result);
        }
    }
}

module.exports = BillController;