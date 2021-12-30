const CarrierBankAccount = require('./CarrierBankAccount');
const HTTPS = require('../AuthController');
const Carrier = require('./Carrier');
const Bill = require('./Bill');
const DB = require('../Mongo');

const url = process.env['triumph.apiUrl'];
const tokenName = 'triumph_access_token';

let triumph;

class Triumph
{
    static async connect()
    {
        if (!triumph?.expCheck())
        {
            const opts =
            {
                url,
                tokenName
            };

            const token = await DB.getSecret({ name: opts.tokenName });

            if (!triumph?.instance)
            {
                triumph = new HTTPS(opts);

                triumph.connect();
            }

            triumph.exp = token.exp;

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

    static async upsertBill(data)
    {
        const api = await Triumph.connect();

        const bill = new Bill(data);

        const res = await api.post('/APISubmitPayor/Invoice', bill);

        return res.data;
    }
}

module.exports = Triumph;
