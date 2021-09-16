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

}

module.exports = Super;