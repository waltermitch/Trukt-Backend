const Variable = require('../Models/Variable');

class VariableService
{
    static async getVariable(query)
    {
        const search = query.replace(/%/g, '');

        const res = await Variable.query().findOne({ name: search });

        return res;
    }

    static async updateVariable(name, data)
    {
        name = name.replace(/%/g, '');

        const res = await Variable.query().insert({ 'data': JSON.stringify(data), 'name': name }).returning('*').onConflict('name').merge();

        return res;
    }
}

module.exports = VariableService;