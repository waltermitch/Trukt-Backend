const table_name = 'loadboard_contacts';

exports.seed = function (knex)
{
    // Deletes ALL existing entries
    return knex(table_name).del()
        .then(function ()
        {
            // Inserts seed entries
            const contacts = [];
            contacts.push({
                loadboard: 'TRUCKSTOP',
                name: 'Team STG',
                phone: '1-800-381-2068',
                email: 'RCGLogistics@mailinator.truckstop.com',
                username: 'RCGLogistics@mailinator.truckstop.com',
                external_id: 'DD4E5E1B-1ACD-EA11-AA81-06739BDFB2C8'
            });
            contacts.push({
                loadboard: 'DAT',
                name: 'Team PWR',
                phone: '972-866-4640',
                email: 'powersports@rcglogistics.com',
                username: 'powersports',
                external_id: '2475504'
            });
            contacts.push({
                loadboard: 'DAT',
                name: 'Team LOG',
                phone: '770-338-3583',
                email: 'vkuzmenko@rcglogistics.com',
                username: 'rcglog',
                external_id: '2503307'
            });
            contacts.push({
                loadboard: 'DAT',
                name: 'Team LOG2',
                phone: '916-999-1234',
                email: 'ymc@rcglogistics.com',
                username: 'rcglog2',
                external_id: '2503310'
            });
            contacts.push({
                loadboard: 'DAT',
                name: 'Team VMTRANS',
                phone: '972-866-4640',
                email: 'ship@rcglogistics.com',
                username: 'vmtrans',
                external_id: '1093209'
            });
            contacts.push({
                loadboard: 'DAT',
                name: 'Team QF11',
                phone: '916-573-6574',
                email: 'ekurudimov@rcglogistics.com',
                username: 'QF11',
                external_id: '2554621'
            });
            contacts.push({
                loadboard: 'DAT',
                name: 'Team QF22',
                phone: '916-573-6574',
                email: 'edancev@rcglogistics.com',
                username: 'QF22',
                external_id: '2554624'
            });
            contacts.push({
                loadboard: 'DAT',
                name: 'Team LKQ',
                phone: '916-573-6599',
                email: 'teamlkq@rcglogistics.com',
                username: 'rcglkq',
                external_id: '2602403'
            });
            return knex(table_name).insert(contacts);
        });
};
