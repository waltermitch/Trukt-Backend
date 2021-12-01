const OrderStopService = require('../Services/OrderStopService');
const NotesService = require('../Services/NotesService');

class OrderJobController
{
    static async getJobNotes(req, res)
    {
        const result = await NotesService.getJobNotes(req.params.jobGuid);

        if (!result)
            res.status(404).json({ 'error': 'Job Not Found' });
        else
            res.status(200).json(result);
    }

    static async updateStopStatus(req, res)
    {
        const result = await OrderStopService.updateStopStatus(req.params, req.body);

        if (result)
            res.status(200).json(result);
    }
}

module.exports = OrderJobController;