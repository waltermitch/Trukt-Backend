const StatusCacheManager = require('../EventManager/StatusCacheManager');
const OrderStopService = require('../Services/OrderStopService');
const OrderJobService = require('../Services/OrderJobService');
const NotesService = require('../Services/NotesService');
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

    static async updateStopStatus(req, res, next)
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
            next(error);
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

            if (response.status >= 400)
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
        catch (error)
        {
            next(error);
        }
    }

    static async setJobToReadySingle(req, res, next)
    {
        try
        {
            const results = await OrderJobService.setJobToReady(req.params.jobGuid, req.session.userGuid);

            // check if there are any successfull status changes. If there are none,
            // throw all the exceptions in the exceptions list
            // otherwise convert all the exceptions into readable json formats
            // so the client can have both the successes and the failures
            if (results.acceptedJobs.length == 0)
            {
                throw results.exceptions;
            }
            else
            {
                results.exceptions = results.exceptions.map(error =>
                {
                    return error.toJson();
                });
            }
            for (const job of results.acceptedJobs)
            {
                emitter.emit('orderjob_status', job.orderGuid);
            }
            res.status(202).json(results);
        }
        catch (e)
        {
            next(e);
        }
    }

    static async markJobAsComplete(req, res)
    {
        await OrderJobService.markJobAsComplete(req.params.jobGuid, req.session.userGuid);

        res.status(200).send();
    }

    static async markJobAsUncomplete(req, res)
    {
        await OrderJobService.markJobAsUncomplete(req.params.jobGuid, req.session.userGuid);

        res.status(200).send();
    }
}

module.exports = OrderJobController;