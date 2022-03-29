const { MissingDataError, DataConflictError, ValidationError } = require('../ErrorHandling/Exceptions');
const { Trimble } = require('@rcg_logistics/trimble-maps-node-sdk');
const LocationLinks = require('../Models/CopartLocationLinks');
const TerminalContacts = require('../Models/TerminalContact');
const telemetryClient = require('../ErrorHandling/Insights');
const GeneralFuncs = require('../Azure/GeneralFunc');
const emitter = require('../EventListeners/index');
const OrderStops = require('../Models/OrderStop');
const Terminal = require('../Models/Terminal');
const Queue = require('../Azure/ServiceBus');
const { mergeDeepRight } = require('ramda');

const key = process.env.TRIMBLE_API_KEY;
const { SYSTEM_USER } = process.env;
const keywordFields =
{
    'country': ['country'],
    'state': ['state'],
    'city': ['city'],
    'zip': ['zipCode'],
    'address': ['street1', 'street2']
};

Trimble.setKey(key);

const terminalsQueue = new Queue({ queue: 'unresolved_terminals' });

class TerminalService
{
    static async geocodeAddress(address)
    {
        const [res] = await Trimble.geocodeAddress(address, { format: true });

        return res;
    }

    static async getById(terminalId)
    {
        const terminal = await Terminal.query()
            .where('rcgTms.terminals.guid', '=', `${terminalId}`)
            .withGraphJoined('[contacts, primaryContact, alternativeContact]');

        return terminal;
    }

    static async search({ rc, pg, ...query })
    {
        // remove unwanted keys that null or empty strings
        for (const key in query)
            if (query[key] == null || query[key] == '')
                delete query[key];

        // query will be an object with key being the query word
        // min 1 page, with default page 1 (1st page)
        // objection is 0 index, so is postgress, user input will be starting page index at 1
        pg = Math.max(0, pg || 0);

        // clamp between 1 and 100 with default value of 10
        rc = Math.min(100, Math.max(1, rc || 10));

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
        else if (Object.keys(query).length == 0)
            orderbypriority.push('name');

        // TODO add comments here cause nobody knows what this is
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

    static async addUnresolvedTerminalToQueue(terminal)
    {
        await terminalsQueue.batchSend([terminal]);
    }

    static async queueUnresolvedTerminals()
    {
        // get all unresolved terminals, that have never been checked
        // we want to get the least recently checked ones first to avoid checking the same address over and over again
        // we can also choose where we want the nulls to go in the result set.
        const terminals = await Terminal.query()
            .where('isResolved', false)
            .andWhere('resolvedTimes', '<', 1)
            .orderByRaw('date_updated ASC NULLS FIRST')
            .limit(200);

        // put the terminals in the queue
        try
        {
            await terminalsQueue.batchSend(terminals);
        }
        catch (err)
        {
            console.log(err);
        }
    }

    static async dequeueUnresolvedTerminals()
    {
        const terminals = await terminalsQueue.getMessages(5);

        await TerminalService.resolveTerminals(terminals);
    }

    static async resolveTerminals(terminals = [])
    {
        for (const t of terminals)
        {
            // first we want to ensure this terminal is not already resolved/deleted
            const terminal = await Terminal.query().findById(t.guid).where('isResolved', false);

            if (!terminal)
                continue;

            try
            {
                // convert object to string
                const terminalAddress = Terminal.createStringAddress(terminal);

                // lookup candidates
                const [candidate] = await Trimble.geocodeAddress(terminalAddress, { format: true });

                // check score of first candidate
                if (candidate?.score <= 2)
                {
                    const { lat, long } = candidate;

                    // at this point we have a match, but we don't know if there is a terminal with this lat/long in the db already
                    // if there is an existing terminal we need to update all the objects related to this terminal to use that one
                    // if no such terminal exists we will simply update this terminal with the lat/long
                    await Terminal.transaction(async trx =>
                    {
                        const existingTerminal = await Terminal.query(trx)
                            .select('guid')
                            .where('latitude', lat)
                            .andWhere('longitude', long)
                            .andWhereNot('guid', terminal.guid)
                            .first();

                        if (existingTerminal)
                        {
                            // this will take the current terminal and move point related records to existing terminal and then delete it
                            await TerminalService.mergeTerminals(existingTerminal, terminal, trx);
                        }
                        else
                        {
                            // this will take the current terminal update the address info, lat/long etc, and set it as resolved
                            await TerminalService.normalizeTerminal(terminal, candidate, trx);
                        }
                    });
                }
                else
                {
                    // if we are here we want to attempt one more lookup, based on a match for properties
                    // this will not resolve the terminal but will merge it into a duplicate unresolved terminal
                    await Terminal.transaction(async trx =>
                    {
                        const existingTerminal = await Terminal.query(trx)
                            .select('guid')
                            .where({
                                'name': terminal.name,
                                'street1': terminal.street1,
                                'city': terminal.city,
                                'state': terminal.state,
                                'zipCode': terminal.zipCode
                            })
                            .andWhereNot('guid', terminal.guid)
                            .first();

                        if (existingTerminal)
                        {
                            await TerminalService.mergeTerminals(existingTerminal, terminal, trx);
                        }
                        else
                        {
                            // if the score is less than 95, we will mark the terminal as unresolved and increment the resolvedTimes
                            await Terminal.query(trx)
                                .where('guid', terminal.guid)
                                .update({ isResolved: false, resolvedTimes: 1, updatedByGuid: SYSTEM_USER });

                        }
                    });
                }
            }
            catch (error)
            {
                /**
                 * Some terminals may return an error when inserting due to unique coordinates constraint,
                 * in those cases we mark those terminals as resolved = false (Which is the default) and resolved_times = 3
                 * so we stop checking that terminal but still know that is not resolved.
                 */
                const message = `Error, terminal ${t.guid} could not be updated: ${error?.nativeError?.detail || error?.message || error}`;
                console.error(message);
                telemetryClient.trackException({
                    exception: error,
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

    // this method will update a terminal with the new information from maps api
    // in the processing normalizing the address formatting, etc and mark it as resolved
    static async normalizeTerminal(terminal, match, trx)
    {
        const { lat, long } = match;

        const payload =
        {
            latitude: lat,
            longitude: long,
            updatedByGuid: SYSTEM_USER,
            isResolved: true
        };

        // add these fields if they exist

        if (match.street)
            payload.street1 = match.street;
        if (match.city)
            payload.city = match.city;
        if (match.state)
            payload.state = match.state;
        if (match.zip)
            payload.zipCode = match.zip;

        // update current terminal with normalized address since no match was found
        await Terminal.query(trx)
            .where('guid', terminal.guid)
            .patch(payload);

        // emit event
        emitter.emit('terminal_resolved', { terminalGuid: terminal.guid });
    }

    // this method will merge one terminal into another including all related records
    static async mergeTerminals(primaryTerminal, alternativeTerminal, trx)
    {
        // if the two terminals are the same, we don't want to do anything
        if (primaryTerminal.guid === alternativeTerminal.guid)
            throw new DataConflictError('Cannot merge a terminal into itself');

        // update all orderStops and terminalContacts from current terminal to existing terminal
        await Promise.all(
            [
                OrderStops.query(trx)
                    .where('terminalGuid', alternativeTerminal.guid)
                    .patch({ terminalGuid: primaryTerminal.guid, updatedByGuid: SYSTEM_USER }),

                // since we can't use onConflict for a patch, we need to do this manually
                TerminalService.mergeContacts(alternativeTerminal.guid, primaryTerminal.guid, trx),

                LocationLinks.query(trx)
                    .where('terminalGuid', alternativeTerminal.guid)
                    .patch({ terminalGuid: primaryTerminal.guid })
            ])
            .then(async ([orderStops, terminalContacts]) =>
            {
                // now that there is nothing attached to this terminal, we can delete it
                await Terminal.query(trx).deleteById(alternativeTerminal.guid);

                // emit event
                emitter.emit('terminal_resolved', { terminalGuid: primaryTerminal.guid });
            });
    }

    static async mergeContacts(oldTerminalGuid, newTerminalGuid, trx)
    {
        // get old and new terminal contacts
        const [oldTerminalContacts, newTerminalContacts] = await Promise.all([
            TerminalContacts.query(trx)
                .where('terminalGuid', oldTerminalGuid),

            TerminalContacts.query(trx)
                .where('terminalGuid', newTerminalGuid)
        ]);

        for (const oldTerminalContact of oldTerminalContacts)
        {
            // try to find a match in the new terminal contacts
            const match = newTerminalContacts.find(newTerminalContact =>
                newTerminalContact.name == oldTerminalContact.name && newTerminalContact.phoneNumber == oldTerminalContact.phoneNumber);

            let newContactGuid;
            if (match)
            {
                newContactGuid = match.guid;
            }

            // if no match we will create a new contact on the new terminal
            else
            {
                const payload = mergeDeepRight(oldTerminalContact, { terminalGuid: newTerminalGuid });

                delete payload.guid;

                const newContact = await TerminalContacts.query(trx).insert(payload);

                newContactGuid = newContact.guid;
            }

            // update all orderStops with old terminal contact to new terminal contact
            await Promise.all([
                OrderStops.query(trx)
                    .where('primaryContactGuid', oldTerminalContact.guid)
                    .patch({ primaryContactGuid: newContactGuid }),

                OrderStops.query(trx)
                    .where('alternativeContactGuid', oldTerminalContact.guid)
                    .patch({ alternativeContactGuid: newContactGuid })
            ]);

            // now we can delete the old contact
            await TerminalContacts.query(trx).deleteById(oldTerminalContact.guid);
        }
    }

    static async findOrCreate(terminal, currentUser, trx, isTender)
    {
        // if a guid is not provided, we will assume this is a new terminal
        if (!terminal.guid)
        {
            return await TerminalService.create(terminal, currentUser, trx, isTender);
        }
        else
        {
            const term = await Terminal.query(trx).findById(terminal.guid);

            // check if the terminal was not found we will create it, no error will be thrown
            // if the terminal was found, we will check if user is trying to change the important fields
            // if so, we will create a new terminal and leave the old one as is
            if (!term)
            {
                return await TerminalService.create(terminal, currentUser, trx, isTender);
            }
            else
            {
                term['#id'] = terminal.index;

                return term;
            }
        }
    }

    static async create(terminal, currentUser, trx, isTender)
    {
        // make sure to delete the guid
        delete terminal.guid;

        const term = Terminal.fromJson(terminal);

        term.setCreatedBy(currentUser);
        term.setDefaultValues(isTender);

        // create a new terminal
        const newTerminal = await Terminal.query(trx).insert(term);

        // everytime we create a new terminal, we want to fire async event to resolve terminal
        emitter.emit('terminal_created', { terminalGuid: newTerminal.guid });

        newTerminal['#id'] = terminal['#id'];

        return newTerminal;
    }

    // this method is only for the /update endpoint and will update a terminal with the new information
    // terminals shouldn't be updated directly in other places like during order creation/update
    static async patchTerminal(terminalGuid, terminal, currentUser, trx = undefined)
    {
        // if there is no guid, throw an error
        if (!terminalGuid)
            throw new MissingDataError('Terminal Must Have A guid');

        const term = Terminal.fromJson(terminal);

        term.setDefaultValues();
        term.setUpdatedBy(currentUser);

        term.isResolved = terminal.isResolved || false;

        // we can't let terminals be resolved without lat/long
        if (term.isResolved && (!term.latitude || !term.longitude))
            throw new MissingDataError('Terminal Must Have Latitude And Longitude To Be Resolved');

        const newTerminal = await Terminal.query(trx)
            .patchAndFetchById(terminalGuid, term);

        return newTerminal;
    }

    // method to calculate the distance between a set of coords
    static async calculateTotalDistance(stops)
    {
        // go through every order stop
        stops.sort(OrderStops.sortBySequence);

        // converting terminals into address strings
        const coords = [];
        for (const stop of stops)
        {
            const { terminal } = stop;

            // we ignore unresolved terminals
            if (terminal.latitude && terminal.longitude)
                coords.push({ lat: terminal.latitude, long: terminal.longitude });
        }

        // we check if we have at least 2 points; otherwise we throw an error
        if (coords.length < 2)
            throw new ValidationError('At least 2 points are required to calculate the distance');
        else
            return await GeneralFuncs.calculateDistance(coords);
    }
}

module.exports = TerminalService;