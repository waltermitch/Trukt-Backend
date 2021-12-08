const OrderStopService = require('../Services/OrderStopService');
const NotesService = require('../Services/NotesService');
const StatusCacheManager = require('../EventManager/StatusCacheManager');
const OrderJobService = require('../Services/OrderJobService');
const emitter = require('../Services/EventEmitter');

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
            res.status(400);
            res.json(error);
        }

    }

    static async getCarrier(req, res)
    {
        const { status, data } = await OrderJobService.getJobCarrier(req.params.jobGuid);
        res.status(status).json(data);
    }

    static async addHold(req, res, next)
    {
        await OrderJobController._toggleHold(true, req, res, next);
    }

    static async removeHold(req, res, next)
    {
        await OrderJobController._toggleHold(false, req, res, next);
    }

    static async _toggleHold(value, req, res, next)
    {
        const jobGuid = req.params.jobGuid;
        const func = value ? OrderJobService.addHold : OrderJobService.removeHold;
        const eventEmitted = value ? 'orderjob_hold_added' : 'orderjob_hold_removed';
        try
        {
            const response = await func(jobGuid, req.session.userGuid);
            
            if(response.status >= 400)
            {
                next(response);
                return;
            }
            else
            {
                emitter.emit(eventEmitted, jobGuid);
                res.status(200);
                res.send();
            }
        }
        catch(error)
        {
            next(error);
        }
    }
}

module.exports = OrderJobController;