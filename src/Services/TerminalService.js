const LocationLinks = require('../Models/CopartLocationLinks');
const TerminalContacts = require('../Models/TerminalContact');
const telemetryClient = require('../ErrorHandling/Insights');
const OrderStops = require('../Models/OrderStop');
const Terminal = require('../Models/Terminal');
const ArcGIS = require('../ArcGIS/API');

const { SYSTEM_USER } = process.env;
const keywordFields =
{
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
        // remove unwanted keys that null or empty strings
        for (const key in query)
            if (query[key] == null || query[key] == '')
                delete query[key];

        // query will be an object with key being the query word
        // min 1 page, with default page 1 (1st page)
        // objection is 0 index, so is postgress, user input will be starting page index at 1
        const pg = Math.max(0, query.pg || 0);

        // clamp between 1 and 100 with default value of 10
        const rc = Math.min(100, Math.max(1, query.rc || 10));

        const qb = Terminal.query();
        let orderbypriority = [];
        const normalOnes = [];
        const searchOnes = [];

        if (query.name || query.search)
        {
            let q = query.name || query.search;

            // remove the following characters from the query: ; * & $ @
            q = q.replace(/[;*&$@]/g, '');

            orderbypriority.push(['name']);

            // split the query by spaces add wild card to the end of each word, and join them with &
            const searchVal = (q.split(' ').filter((word) =>
            {
                if (word.length > 0)
                    return word + ':*';
            })).join(' & ');

            qb.whereRaw('vector_name @@ to_tsquery(\'english\', ? )', [searchVal]);
        }

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
            qb.where((builder) =>
            {
                for (const o of normalOnes)
                {
                    const q = o.query.replace(/%/g, '');
                    builder.orWhere(`${o.field}`, 'ilike', `%${q}%`);
                }
            });

        if (searchOnes.length > 0)
            qb.orWhere((builder) =>
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
            qb.where('latitude', query.lat);
        }

        if ('long' in query)
        {
            orderbypriority.push('longitude');
            qb.where('longitude', query.long);
        }

        orderbypriority = orderbypriority.map((x) => { return { column: `rcgTms.terminals.${x}`, order: 'asc' }; });
        qb.orderBy(orderbypriority).page(pg, rc);

        const terminal = await qb.withGraphFetched('[primaryContact, alternativeContact, contacts]');

        return terminal.results || terminal;
    }

    static async resolveTerminals(limit = 100)
    {
        // get all unresolved terminals, that have been checked for max 3 times
        // we want to get the least recently checked ones first to avoid checking the same address over and over again
        // we can also choose where we nulls go in the result set.
        const terminals = await Terminal.query()
            .where('isResolved', false)
            .andWhere('resolvedTimes', '<', 1)
            .orderByRaw('date_updated ASC NULLS FIRST')
            .limit(limit);

        for (const terminal of terminals)
        {
            const { guid } = terminal;
            try
            {
                // convert object to string
                const terminalAddress = Terminal.createStringAddress(terminal);

                // lookup candidates
                const [candidate] = await ArcGIS.findMatches(terminalAddress);

                // check score of first candidate
                if (candidate?.score > 95)
                {
                    const coords = ArcGIS.parseGeoCoords(candidate);

                    // at this point we have a match, but we don't know if there is a terminal with this lat/long in the db already
                    // if there is an existing terminal we need to update all the objects related to this terminal to use that one
                    // if no such terminal exists we will simply update this terminal with the lat/long
                    const [existingTerminal, trx] = await Promise.all(
                        [
                            Terminal.query()
                                .select('guid')
                                .where('latitude', coords.lat)
                                .andWhere('longitude', coords.long)
                                .first(),

                            Terminal.startTransaction()
                        ]);

                    if (existingTerminal)
                    {
                        // update all orderStops and terminalContacts from current terminal to existing terminal
                        await Promise.all(
                            [
                                OrderStops.query(trx)
                                    .where('terminalGuid', guid)
                                    .update({ terminalGuid: existingTerminal.guid, updatedByGuid: SYSTEM_USER }),

                                TerminalContacts.query(trx)
                                    .where('terminalGuid', guid)
                                    .update({ terminalGuid: existingTerminal.guid, updatedByGuid: SYSTEM_USER })
                                    .onConflict(['phone_number', 'name', 'terminal_guid']).merge(),

                                LocationLinks.query(trx)
                                    .where('terminalGuid', guid)
                                    .update({ terminalGuid: existingTerminal.guid })
                            ])
                            .then(async ([orderStops, terminalContacts]) =>
                            {
                                // now that there is nothing attached to this terminal, we can delete it
                                await Terminal.query(trx).deleteById(guid);

                                await trx.commit();
                            })
                            .catch(async (err) =>
                            {
                                // need to rollback the transaction here
                                await trx.rollback();
                                throw err;
                            });
                    }
                    else
                    {
                        const payload =
                        {
                            latitude: coords.lat,
                            longitude: coords.long,
                            updatedByGuid: SYSTEM_USER,
                            isResolved: true
                        };

                        // add these fields if they exist
                        const { attributes: atr } = candidate;

                        if (atr.StAddr)
                            payload.street1 = atr.StAddr;
                        if (atr.City)
                            payload.city = atr.City;
                        if (atr.State)
                            payload.state = atr.RegionAbbr || atr.Region;
                        if (atr.Postal)
                            payload.zipCode = atr.Postal;

                        // update current terminal with normalized address since no match was found
                        await Terminal.query()
                            .where('guid', guid)
                            .patch(payload);
                    }
                }
                else
                {
                    // if the score is less than 95, we will mark the terminal as unresolved and increment the resolvedTimes
                    await Terminal.query()
                        .where('guid', guid)
                        .update({ isResolved: false, resolvedTimes: terminal.resolvedTimes + 1, updatedByGuid: SYSTEM_USER });
                }
            }
            catch (error)
            {
                /**
                 * Some terminals may return an error when inserting due to unique coordinates constraint,
                 * in those cases we mark those termianls as resolved = false (Which is the default) and resolved_times = 3
                 * so we stop checking that terminal but still know that is not resolved.
                 */
                const message = `Error, terminal ${guid} could not be updated: ${error?.nativeError?.detail || error?.message || error}`;
                console.error(message);
                telemetryClient.trackException({
                    exception: new Error(message),
                    properties:
                    {
                        guid: terminal.guid,
                        name: terminal.name,
                        street1: terminal.street1,
                        street2: terminal.street2,
                        city: terminal.city,
                        state: terminal.state,
                        postalCode: terminal.zipCode,
                        latitude: terminal.latitude,
                        longitude: terminal.longitude
                    },
                    severity: 2
                });
            }
        }
    }
}

module.exports = TerminalService;