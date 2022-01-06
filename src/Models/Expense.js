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
    constructor(account, item, amount, commodity, job, guid)
    {
        this.account = account;
        this.item = item;
        this.amount = amount;
        this.commodity = commodity;
        this.job = job;
        this.guid = guid;
    }

    static fromInvoiceLine(orderjob, invoice, line)
    {
        const OrderJob = require('./OrderJob');
        const Order = require('./Order');
        let accountType;
        let job;
        if (orderjob instanceof Order)
        {
            for (const type of [
                'client',
                'consignee',
                'dispatcher',
                'referrer',
                'salesperson'
            ])
            {
                if (orderjob[type]?.guid == invoice.consigneeGuid && invoice.consigneeGuid != undefined)
                {
                    accountType = type;
                    break;
                }
            }
        }
        else if (orderjob instanceof OrderJob)
        {
            job = orderjob.guid;
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
            job,
            line.guid
        );
    }
}

module.exports = Expense;