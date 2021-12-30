const StatusManagerService = require('../../src/Services/StatusManagerService');
const Queue = require('../Azure/ServiceBus');

const QUEUE_NAME = process.env['azure.servicebus.statusManager.queueName'];

class StatusManagerHandler
{
    static async checkStatus()
    {
        const res = await Queue.pop(QUEUE_NAME);
        if (res.status === 204)
            return;
        else
            await StatusManagerHandler.logStatus(res.data);
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
            return await Queue.push(QUEUE_NAME, statusLogData);
        }
        catch (error)
        {
            console.error(`Error, status was not pushed to service bus: ${error}`);
        }
    }
}

module.exports = StatusManagerHandler;