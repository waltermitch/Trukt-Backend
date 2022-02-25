const { DataConflictError } = require('../ErrorHandling/Exceptions');
const PicklistService = require('../Services/PicklistService');

class PicklistController
{
    static async get(req, res, next)
    {
        try
        {
            const result = await PicklistService.getPicklists();
    
            if (result)
                res.status(200).json(result);
            else
                throw new DataConflictError('Something went wrong');
        }
        catch (error)
        {
            next(error);
        }
    }
}

module.exports = PicklistController;