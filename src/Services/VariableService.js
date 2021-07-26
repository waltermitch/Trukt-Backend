const Variable = require('../Models/Variable');

class VariableService
{
    static async get(query)
    {
        const search = query.replace(/%/g, '');

        const res = await Variable.query().findOne({ name: search });

        return res?.data || res;
    }

    static async update(name, data)
    {
        name = name.replace(/%/g, '');

        const res = await Variable.query().insert({ 'data': JSON.stringify(data), 'name': name }).returning('*').onConflict('name').merge();

        return res;
    }
}

module.exports = VariableService;