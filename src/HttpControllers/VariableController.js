const VariableService = require('../Services/VariableService');

class VariableController
{
    static async get(req, res, next)
    {
        try
        {
            const q = req.params.name;
    
            const result = await VariableService.get(q);
    
            res.status(200);
            res.json(result);
        }
        catch (error)
        {
            next(error);
        }
    }

    static async put(req, res, next)
    {
        try
        {
            await VariableService.update(req.body.name, req.body);
    
            res.status(200).send();
        }
        catch (error)
        {
            next(error);
        }
    }
}

module.exports = VariableController;