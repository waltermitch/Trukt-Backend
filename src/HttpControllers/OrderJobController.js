const OrderStopService = require('../Services/OrderStopService');
const NotesService = require('../Services/NotesService');
const StatusCacheManager = require('../EventManager/StatusCacheManager');

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
        try
        {
            const result = await OrderStopService.updateStopStatus(req.params, req.body);
            if (result)
            {
                res.status(200).json(result);
            }
        }
        catch (error)
        {
            res.status(404);
            res.json(error.message);
        }
    }

    static async getAllStatusCount(req, res)
    {
        try
        {
            const result = await StatusCacheManager.returnUpdatedCache();
            if (result)
            {
                res.status(200);
                res.json(result);
            }
        }
        catch (error)
        {
            console.log(error);
            res.status(400);
            res.json(error);
        }

    }
}

module.exports = OrderJobController;