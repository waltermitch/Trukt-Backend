// new Items
const items = [
    { name: 'Transport', type: 'revenue' },
    { name: 'Keys', type: 'expense' },
    { name: 'Storage', type: 'expense' },
    { name: 'Fuel Surcharge', type: 'expense' },
    { name: 'Repossession Fee', type: 'expense' },
    { name: 'Impound Fee', type: 'expense' }
];

// old Items made by vlad
// const items = [
//     { name: 'Transport', type: 'revenue' },
//     { name: 'Lumper', type: 'revenue' },
//     { name: 'Referral', type: 'expense' },
//     { name: 'Fuel Surcharge', type: 'revenue', is_accessorial: true },
//     { name: 'Unloading', type: 'revenue', is_accessorial: true },
//     { name: 'Refund', type: 'expense', is_accessorial: false },
//     { name: 'Deduction', type: 'expense', is_accessorial: false },
//     { name: 'Duplicate car keys', type: 'revenue', is_accessorial: true },
//     { name: 'Laser-Cut Transponder key', type: 'revenue', is_accessorial: true },
//     { name: 'Mechanical Key', type: 'revenue', is_accessorial: true },
//     { name: 'Program Car Remotes', type: 'revenue', is_accessorial: true },
//     { name: 'Program Keys', type: 'revenue', is_accessorial: true },
//     { name: 'Proximity Fob w/last cut key override', type: 'revenue', is_accessorial: true },
//     { name: 'Remote/Key Combo', type: 'revenue', is_accessorial: true },
//     { name: 'Replace Car Fobs', type: 'revenue', is_accessorial: true },
//     { name: 'Replace Car Remotes', type: 'revenue', is_accessorial: true },
//     { name: 'Self Programmable Remote', type: 'revenue', is_accessorial: true },
//     { name: 'Sell Car Remotes', type: 'revenue', is_accessorial: true },
//     { name: 'Tibbe Key', type: 'revenue', is_accessorial: true },
//     { name: 'Transponder Key', type: 'revenue', is_accessorial: true },
//     { name: 'Services', type: 'expense', is_accessorial: false }
// ];

exports.seed = async function (knex)
{
    return knex('rcg_tms.invoice_bill_line_items').insert(items).onConflict(['name']).ignore();
};
