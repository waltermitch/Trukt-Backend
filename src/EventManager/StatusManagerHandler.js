const StatusManagerService = require('../../src/Services/StatusManagerService');
const Queue = require('../Azure/ServiceBus');

const QUEUE_NAME = 'status_manager';

// this be a subscription based queue for streaming event updates
const managerQueue = new Queue({ queue: QUEUE_NAME });

class StatusManagerHandler
{
    static async checkStatus()
    {
        const res = await managerQueue.getMessages(1);

        if (res.length > 0)
            await StatusManagerHandler.logStatus(res[0]);

    }

    static async logStatus(statusLogData)
    {
        try
        {
            return await StatusManagerService.createStatusLog(statusLogData);
        }
        catch (error)
        {
            console.error(`Error, status not saved: ${error}`);
        }

    }

    /**
     * @param statusLogData.userGuid required
     * @param statusLogData.orderGuid required
     * @param statusLogData.jobGuid required
     * @param statusLogData.statusId required, id from status_log_types table
     * @param statusLogData.extraAnnotations optional, json with extra information to add in the log
     */
    static async registerStatus(statusLogData)
    {
        try
        {
            StatusManagerService.validateCreateStatusLogInput(statusLogData);
            return await managerQueue.batchSend(statusLogData);
        }
        catch (error)
        {
            console.error(`Error, status was not pushed to service bus: ${error}`);
        }
    }
}

module.exports = StatusManagerHandler;