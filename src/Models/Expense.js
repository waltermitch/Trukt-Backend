const Order = require('./Order');
const OrderJob = require('./OrderJob');

class Expense
{
    /**
     * @type {string}
     */
    account;

    /**
     * @type {string}
     */
    item;

    /**
     * @type {number}
     */
    amount;

    /**
     * @type {string}
     */
    commodity;

    /**
     * @type {string}
     */
    job;

    /**
     *
     * @param {string} account
     * @param {string} item
     * @param {number} amount
     * @param {string} commodity
     * @param {string} job
     */
    constructor(account, item, amount, commodity, job)
    {
        this.account = account;
        this.item = item;
        this.amount = amount;
        this.commodity = commodity;
        this.job = job;
    }

    static fromInvoiceLine(orderjob, invoice, line)
    {
        let accountType;
        let job;
        if (orderjob instanceof Order)
        {
            for (const type of [
                'client',
                'cosignee',
                'dispatcher',
                'referrer',
                'salesperson'
            ])
            {
                if (orderjob[type]?.guid == invoice.cosigneeGuid && invoice.cosigneeGuid != undefined)
                {
                    accountType = type;
                    break;
                }
            }
        }
        else if (orderjob instanceof OrderJob)
        {
            accountType = 'vendor';
        }
        else
        {
            throw new Error('orderjob param is not correct type');
        }

        return new Expense(
            accountType,
            line.item.name,
            line.amount,
            line.commodity?.guid || line.commodityGuid,
            job
        );
    }
}

module.exports = Expense;