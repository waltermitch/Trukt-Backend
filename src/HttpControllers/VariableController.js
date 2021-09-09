const VariableService = require('../Services/VariableService');

class VariableController
{
    static async get(req, res)
    {
        const q = req.params.name;

        const result = await VariableService.get(q);

        res.status(200);
        res.json(result);
    }

    static async put(req, res)
    {
        await VariableService.update(req.body.name, req.body);

        res.status(200).send();
    }
}

module.exports = VariableController;