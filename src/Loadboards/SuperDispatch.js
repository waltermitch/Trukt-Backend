const AuthController = require('../AuthController');
const ErrorHandler = require('../ErrorHandler');

// SD singleton
let sd;

class Super
{
    constructor()
    {

    }

    static async getSuper()
    {
        // if super instance exist'
        if (!sd?.expCheck())
        {
            // compose options
            const options = {
                url: 'https://api.staging.shipper.superdispatch.org',
                tokenName: 'super_access_token_staging'
            };

            // initialize
            sd = new AuthController(options);

            // get token
            const token = await sd?.getSecret({ 'name': sd.tokenName });

            // set token expire time
            sd.exp = token.exp;

            if (!sd.instance)
                sd?.connect();

            // set token
            sd.setToken(token.value);
        }

        // returning super instance
        return sd.instance;
    }

    static async getOrderActivities(guid)
    {
        // get super
        const sd = await Super.getSuper();

        // getting order activities
        const res = await sd.get(`/v1/public/orders/${guid}/activities`);

        // returing objects array
        return res.data.data.objects;
    }

    static async getCarriersByDOT(USDOT)
    {
        // get super
        const sd = await Super.getSuper();

        // cost get carrier
        const res = await sd.get(`/v1/public/carriers/full_search?query=${USDOT}`);

        // returning array of objects
        return res.data.data.objects;
    }

    static async getCarrier(guid)
    {
        // get super
        const sd = await Super.getSuper();

        // get carrier
        const res = await sd.get(`/v1/public/carriers/${guid}/profile`);

        return res.data.data.object;
    }

    static async getCustomerByExternalId(customerId)
    {
        // get super
        const sd = await Super.getSuper();

        // patchers
        const res = await sd.get(`/v1/public/customers/custom_external_id/${customerId}`);

        // return nested object
        return res.data.data.objects;
    }

    static async declineLoadRequest(orderGuid, requestGuid, body)
    {
        // get super
        const sd = await Super.getSuper();

        const res = await sd.put(`/v1/public/orders/${orderGuid}/requests/${requestGuid}/decline`, body);

        return res?.data?.data?.object;
    }

    static async acceptLoadRequest(orderGuid, requestGuid)
    {
        // get super
        const sd = await Super.getSuper();

        const res = await sd.put(`/v1/public/orders/${orderGuid}/requests/${requestGuid}/accept`);

        return res?.data?.data?.object;
    }

    static processPromises(context, proms)
    {
        for (let i = 0; i < proms.length; i++)
        {
            if (!proms[i].status.localeCompare('rejected'))
                new ErrorHandler(context, proms[i].reason);
            else
                context.log(proms[i]);
        }
    }
}

module.exports = Super;