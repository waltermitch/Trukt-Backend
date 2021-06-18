const Terminal = require('../Models/Terminal');

const keywordFields = {
    'name': ['name'],
    'country': ['country'],
    'state': ['state'],
    'city': ['city'],
    'zip': ['zipCode'],
    'address': ['street1', 'street2']
};

class TerminalService
{
    static async getById(terminalId)
    {
        const terminal = await Terminal.query().where('rcgTms.terminals.guid', '=', `${terminalId}`).withGraphJoined('[contacts, primaryContact, alternativeContact]');
        return terminal;
    }

    static async search(query)
    {
        for (const key in query)

            // remove unwanted keys that undefined or empty strings
            if (query[key] == undefined || query[key] == '')

                delete query[key];

        // query will be an object with key being the query word
        // min 1 page, with default page 1 (1st page)
        // objection is 0 index, so is postgress, user input will be starting page index at 1
        const pg = Math.max(1, query.pg || 1) - 1;

        // clamp between 0 and 100 with default value of 10
        const rc = Math.min(100, Math.max(1, query.rc || 10));

        let qb = Terminal.query();
        let orderbypriority = [];
        const normalOnes = [];
        const searchOnes = [];

        for (const keyword in keywordFields)

            if (keyword in query)

                for (const field of keywordFields[keyword])
                {
                    orderbypriority.push(field);
                    normalOnes.push({ field: field, query: query[keyword] });
                }

        if ('search' in query)

            for (const keyword in keywordFields)

                if (!(keyword in query))

                    for (const field of keywordFields[keyword])
                    {
                        orderbypriority.push(field);
                        searchOnes.push({ field: field, query: query.search });
                    }

        if (normalOnes.length > 0)

            qb = qb.where((builder) =>
            {
                for (const o of normalOnes)
                {
                    const q = o.query.replace(/%/g, '');
                    builder.orWhere(`${o.field}`, 'ilike', `%${q}%`);
                }
            });

        if (searchOnes.length > 0)

            qb = qb.where((builder) =>
            {
                for (const o of searchOnes)
                {
                    const q = o.query.replace(/%/g, '');
                    builder.orWhere(`${o.field}`, 'ilike', `%${q}%`);
                }
            });

        if ('lat' in query)
        {
            orderbypriority.push('latitude');
            qb = qb.where('latitude', query.lat);
        }
        if ('long' in query)
        {
            orderbypriority.push('longitude');
            qb = qb.where('longitude', query.long);
        }

        orderbypriority = orderbypriority.map((x) => { return { column: `rcgTms.terminals.${x}`, order: 'asc' }; });

        qb = qb.orderBy(orderbypriority).page(pg, rc);
        const terminal = await qb.withGraphFetched('[primaryContact, alternativeContact, contacts]');

        return terminal.results || terminal;
    }
}

module.exports = TerminalService;