const VariableService = require('../Services/VariableService');
const CarrierBankAccount = require('./CarrierBankAccount');
const HTTPS = require('../AuthController');
const Carrier = require('./Carrier');

let triumph;

class Triumph
{
    static async connect()
    {
        if (!triumph?.expCheck())
        {
            const opts =
            {
                url: process.env['triumph.apiUrl'],
                tokenName: process.env['triumph.tokenName']
            };

            const token = await HTTPS.getSecret({ name: opts.tokenName });

            if (!triumph?.instance)
            {
                triumph = new HTTPS(opts);

                triumph.connect();
            }

            triumph.exp = token?.exp;

            triumph.setToken(token?.value);
        }

        return triumph.instance;
    }

    static async createCarrierProfile(data)
    {
        const carrier = new Carrier(data);

        const api = await Triumph.connect();

        await api.post('/APISubmitPayor/PayeeProfile', carrier);

        if (data.bankAccountNumber)
        {
            const bankInfo = new CarrierBankAccount(data);

            await api.post('/APISubmitPayor/PayeeBankAccount', bankInfo);
        }
    }

    static async refreshToken()
    {
        const api = await Triumph.connect();

        // remove auth header
        delete api.defaults.headers.common['Authorization'];

        const payload =
        {
            'api_key': process.env['triumph.apiKey'],
            'password': process.env['triumph.password'],
            'username': process.env['triumph.username']
        };

        const res = await api.post('/APILogin/BasicAuthentication', payload);

        console.log(res.data);

        const data =
        {
            name: 'triumph_access_token',
            value: res.data.access_token,
            exp: HTTPS.getUTC()
        };

        // save token to pg
        await VariableService.update(data.name, data);
    }
}

module.exports = Triumph;
