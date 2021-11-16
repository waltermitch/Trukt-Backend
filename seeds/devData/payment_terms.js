// new Items
const items = [
    { name: 'Same Day Pay (5%)' },
    { name: '2-Day QuickPay (2%)' },
    { name: '2-Day QuickPay (NC)' },
    { name: 'Net 15' },
    { name: 'Net 30' }
];

exports.seed = async function (knex)
{
    return knex('rcg_tms.invoice_bill_payment_terms').insert(items).onConflict(['name']).ignore();
};
