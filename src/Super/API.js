const SFAccount = require('../Models/SFAccount');
const HTTPS = require('../AuthController');
const Carrier = require('./Carrier');
const Client = require('./Client');

// SD singleton
let sd;

// sd internal singleton
// let internal;

class Super
{
    static async connect()
    {
        // if super instance exist'
        if (!sd?.expCheck())
        {
            // compose options
            const options = {
                url: process.env['super.apiUrl'],
                tokenName: process.env['super.tokenName']
            };

            // get token
            const token = await HTTPS.getSecret({ 'name': sd.tokenName });

            // set token expire time
            sd.exp = token.exp;

            if (!sd.instance)
            {
                // initialize
                sd = new HTTPS(options);

                sd?.connect();
            }

            // set token
            sd.setToken(token.value);
        }

        return sd.instance;
    }

    static async createClient(payload)
    {
        // get Super
        const sd = await Super.getSuper();

        // post to creat customer
        const res = await sd.post('/v1/public/customers', payload);

        // returning status with customer guid
        return { 'status': res.status, 'guid': res.data.data.object.guid };
    }

    static async updateClient(guid, payload)
    {
        // get Super
        const sd = await Super.getSuper();

        // updating Client
        const res = await sd.put(`/v1/public/customers/${guid}`, payload);

        // retuing status and cutomer guid
        return { 'status': res.status, 'guid': res.data.data.object.guid };
    }

    static async getClientByExternalId(clientId)
    {
        // get super
        const sd = await Super.getSuper();

        // patchers
        const res = await sd.get(`/v1/public/customers/custom_external_id/${clientId}`);

        // return nested object
        return res.data.data.objects;
    }

    static async getClient(guid)
    {
        // get super
        const sd = await Super.getSuper();

        // getting info
        const res = await sd.get(`/v1/public/customers/${guid}`);

        // returning object
        return res.data.data.object;
    }

    static async upsertClient(data)
    {
        const client = new Client(data);

        if (!data.sdGuid)
        {
            // look up by sf id
            const res = await Super.getClientByExternalId(data.sfId);

            if (res.length == 0)
            {
                // create client and save guid
                const newClient = await Super.createClient(client);
                await SFAccount.query().patch({ sdGuid: newClient.guid }).where('guid', data?.guid);
                return;
            }
            else
            {
                // update and set guid in our db
                await Promise.allSettled([Super.updateClient(res[0].guid, client), SFAccount.query().patch({ sdGuid: res[0].guid }).where('guid', data?.guid)]);
            }
        }
        else
        {
            // simply update
            await Super.updateClient(data.sdGuid, client);
        }

    }

    static async updateCarrier(guid, data)
    {
        const carrier = new Carrier(data);

        const sd = await Super.getSuper();

        const res = await sd.put(`/v1/public/carriers/${guid}/profile`, carrier);

        return res;
    }

    static async getCarrier(guid)
    {
        const sd = await Super.getSuper();

        const res = await sd.get(`/v1/public/carriers/${guid}/profile`);

        return res.data.data.object;
    }

    static async getCarrierByExternalId(id)
    {
        const sd = await Super.getSuper();

        // get carrier by salesforce ID
        const res = await sd.get(`/v1/public/carriers/custom_external_id/${id}`).
            catch((err) =>
            {
                if (err.response.status == 404)
                    return null;
                else
                    throw err;
            });

        // returning the first object in array
        return res.data.data.objects[0];
    }

    static async getCarrierByDOT(dot)
    {
        const arr = await Super.queryCarriers(dot);

        for (let i = 0; i < arr.length; i++)
            if (!dot?.localeCompare(arr[i]?.us_dot))
                return arr[i];

        return null;
    }

    static async queryCarriers(q)
    {
        const sd = await Super.getSuper();

        const res = await sd.get(`/v1/public/carriers/full_search?query=${q}`);

        return res.data.data.objects;
    }

    static async upsertCarrier(data)
    {
        if (!data.sdGuid)
        {
            // try looking up by sf id and then dot
            let res = await Super.getCarrierByExternalId(data.sfId);

            if (!res)
            {
                // search by dot
                res = await Super.getCarrierByDOT(data.dotNumber);

                if (!res)
                {
                    // mark carrier not synced in Postgres
                    await SFAccount.query().patch({ is_synced_in_super: false }).where('guid', data?.guid);
                }
            }

            // if we got here then we can update and save sdguid to database and mark as synced
            await Promise.all([Super.updateCarrier(res.guid, data), SFAccount.query().patch({ sdGuid: res.guid, is_synced_in_super: true }).where('guid', data?.guid)]);
        }
        else
        {
            // update carrier
            await Super.updateCarrier(data.sdGuid, data);
        }
    }
}

module.exports = Super;