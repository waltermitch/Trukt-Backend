const Terminal = require('../Models/Terminal');

const searchFields = [
    'name',
    'street1',
    'street2',
    'city',
    'zipCode',
    'state'
];

class TerminalService
{
    static async getById(terminalId)
    {
        const terminal = await Terminal.query().where('guid', '=', `${terminalId}`).withGraphJoined('[contacts, primaryContact, alternativeContact]');
        return terminal;
    }

    static async search(keyword)
    {
        const terminal = await Terminal.query().withGraphJoined('[contacts, primaryContact, alternativeContact]').orWhere(builder =>
        {
            for (const field of searchFields)
                builder.orWhere(field, 'ilike', `%${keyword}%`);

        });
        return terminal;
    }
}

module.exports = TerminalService;