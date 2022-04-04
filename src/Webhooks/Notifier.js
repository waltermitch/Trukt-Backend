// This is a temporary solution
// One day we will have a proper notification system
const HTTPS = require('../AuthController');

const { ARI_FUNC_URL, ARI_FUNC_CODE } = process.env;

const opts =
{
    url: ARI_FUNC_URL,
    params: { code: ARI_FUNC_CODE }
};

const ari = new HTTPS(opts).connect();

class Notifier
{
    static async orderDistanceUpdated(payload)
    {
        await ari.post('/validateFinances', payload);

        return 'OK';
    }

}

module.exports = Notifier;