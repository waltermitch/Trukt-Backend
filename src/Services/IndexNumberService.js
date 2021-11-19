const { orderNumberRegex } = require('../Utils/Regexes');
const IndexNumber = require('../Models/IndexNumber');

const knex = IndexNumber.knex();

class IndexNumberService
{
    static async nextOrderNumber(count = 1)
    {
        const orderNumber = [];
        for (let i = 0; i < count; i++)
        {
            const result = await knex.raw('SELECT rcg_next_order_number()');
            orderNumber.push(result?.rows?.[0]?.rcg_next_order_number);
        }

        return orderNumber.length == 1 ? orderNumber[0] : orderNumber;
    }

    static async nextJobNumber(orderNumber, count = 1)
    {
        let jobNumber;
        if (orderNumber && orderNumberRegex.test(orderNumber))
        {
            const qnums = [];
            for (let i = 0; i < count; i++)
                qnums.push('a' + i);

            try
            {
                const result = await knex.raw('SELECT ' + qnums.map(x => `rcg_next_order_job_number(:orderNumber) as ${x}`).join(', ') + ';', { orderNumber });
                jobNumber = result?.rows?.[0];
                jobNumber = Object.values(jobNumber);
            }
            catch (err)
            {
                let errorMsg = '';
                if (count > 1)
                {
                    const index = await IndexNumber.query().findById(orderNumber);
                    const jobLimit = index?.nextIndex ? 90 - index.nextIndex.charCodeAt(0) : 26;
                    errorMsg = 'you can only create another ' + jobLimit + ' number of jobs for order ' + orderNumber;
                }
                else
                {
                    errorMsg = 'cannot create any more jobs for order ' + orderNumber;
                }

                throw new Error(errorMsg);
            }
        }
        return jobNumber.length == 1 ? jobNumber[0] : jobNumber;
    }
}

module.exports = IndexNumberService;