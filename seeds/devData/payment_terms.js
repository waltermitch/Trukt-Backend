// new Items
const items = [
    { name: 'Same Day Pay (5%)', id: 1 },
    { name: '2-Day QuickPay (2%)', id: 2 },
    { name: '2-Day QuickPay (NC)', id: 3 },
    { name: 'Net 15', id: 4 },
    { name: 'Net 30', id: 5 }
];

exports.seed = async function (knex)
{
    return knex('rcg_tms.invoice_bill_payment_terms').insert(items).onConflict(['id']).merge();
};
