const telemetryClient = require('../ErrorHandling/Insights');
const ArcgisClient = require('../ArcgisClient');
const Terminal = require('../Models/Terminal');

const keywordFields = {
    'country': ['country'],
    'state': ['state'],
    'city': ['city'],
    'zip': ['zipCode'],
    'address': ['street1', 'street2']
};

const { SYSTEM_USER } = process.env;

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
            const searchVal = (q.split(' ').map((word) => word + ':*')).join(' & ');

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

    /**
     * Returns terminals that hasn't being resolved and hasn't been
     * checked for max 3 times (This is to avoid checking an unverifiable address forever)
     */
    static async getUnverifiedTerminals(limit = 100)
    {
        return Terminal.query().select()
            .where('isResolved', false)
            .andWhere('resolvedTimes', '<', 3)
            .orderBy('dateCreated', 'resolvedTimes')
            .limit(limit) || [];
    }

    static async resolveTerminal(terminal)
    {
        const { guid } = terminal;
        try
        {
            const terminalAddress = Terminal.createStringAddress(terminal);
            const arcgisAddress = await ArcgisClient.findGeocode(terminalAddress);
            const terminalToUpdate = TerminalService.updateTerminalInformation(arcgisAddress, terminal, SYSTEM_USER);

            return await TerminalService.updateTerminal(terminalToUpdate);
        }
        catch (error)
        {
            /**
             * Some terminals may return an error when inserting due to unique coordinates constraint,
             * in those cases we mark those termianls as resolved = false (Which is the default) and resolved_times = 3
             * so we stop checking that terminal but still know that is not resolved.
             */
            try
            {
                const message = `Error, terminal ${guid} could not be resovled: ${error?.nativeError?.detail || error?.message || error}`;
                console.error(message);

                const unresolvedTerminalToUpdate = {
                    guid,
                    resolvedTimes: 3,
                    updatedByGuid: SYSTEM_USER
                };
                return await TerminalService.updateTerminal(unresolvedTerminalToUpdate);
            }
            catch (err)
            {
                const message = `Error, terminal ${guid} could not be updated: ${err?.nativeError?.detail || err?.message || err}`;
                console.error(message);
                telemetryClient.trackException({
                    exception: new Error(message),
                    properties: {
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
                throw { message };
            }
        }
    }

    static async updateTerminal(terminal)
    {
        return await Terminal.query()
            .patch(terminal)
            .where('guid', terminal.guid);
    }

    /**
     * Latitude is arcgis.Y
     * Longitude is arcgis.X
     * https://developers.arcgis.com/rest/geocode/api-reference/geocoding-find-address-candidates.htm#ESRI_SECTION1_CF39B0C8FC2547C3A52156F509C555FC
     */
    static updateTerminalInformation(arcgisAddress, { guid, resolvedTimes }, system_user)
    {
        const termninalToUpdate = {
            guid,
            updatedByGuid: system_user,
            resolvedTimes
        };

        if (ArcgisClient.isAddressFound(arcgisAddress))
        {
            termninalToUpdate.latitude = arcgisAddress.location.y;
            termninalToUpdate.longitude = arcgisAddress.location.x;
            termninalToUpdate.isResolved = true;
        }
        else
            termninalToUpdate.resolvedTimes++;

        return termninalToUpdate;
    }
}

module.exports = TerminalService;