const PicklistService = require('../Services/PicklistService');

class PicklistController
{
    static async get(req, res)
    {
        const result = await PicklistService.getPicklists();

        if (result)
            res.status(200).json(result);
        else
            res.status(500).send();
    }
}

module.exports = PicklistController;