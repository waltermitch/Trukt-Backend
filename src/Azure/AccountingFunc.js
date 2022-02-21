const OrderStop = require('../Models/OrderStop');
const HTTPS = require('../AuthController');

const url = process.env.ACCOUNTING_FUNC_URL;
const code = process.env.ACCOUNTING_FUNC_CODE;

const opts =
{
    url,
    params: { code }
};

const api = new HTTPS(opts).connect();

class AccountingFunc
{
    // this method sends the invoices to AccountingFunc
    // the microservice will create the invoices in the necessary third party system
    static async exportInvoices(invoices)
    {
        const { data } = await api.post('/export/invoices', { invoices });

        return data;
    }

    // this method sends the bills to AccountingFunc
    // the microservice will create the bills in the necessary third party system
    static async exportBills(bills)
    {
        const { data } = await api.post('/export/bills', { bills });

        return data;
    }

    // this method composes the expected description in the AccountingFunc
    static composeDescription(line)
    {
        const { commodity } = line;

        if (commodity)
        {
            const stops = OrderStop.firstAndLast(commodity?.stops);

            const pTerminal = stops[0]?.terminal;
            const dTerminal = stops[1]?.terminal;

            let description = `${pTerminal.city}, ${pTerminal.state} to ${dTerminal.city}, ${dTerminal.state}\n`;

            if (line?.item?.name?.localeCompare('Logistics') || line.item?.name?.includes('Vehicle Shipping'))
            {
                if (commodity.description)
                    description += commodity.description + '\n';
                if (commodity.vehicle?.name)
                    description += commodity.vehicle.name + '\n';
                if (commodity.identifier)
                    description += `VIN: ${commodity.identifier}`;
            }

            return description;
        }
        else
        {
            return line.notes || '';
        }
    }
}

module.exports = AccountingFunc;