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
                name: 'Team MGT',
                phone: '916-573-6568',
                email: 'management@rcglogistics.com',
                username: 'management@rcglogistics.com',
                external_id: '0B823063-3AF5-EB11-AAEA-065441B9C395'
            });
            contacts.push({
                loadboard: 'TRUCKSTOP',
                name: 'Team PWR',
                phone: '972-866-4640',
                email: 'powersports@rcglogistics.com',
                username: 'powersports@rcglogistics.com',
                external_id: 'E1C7A805-3C0A-EA11-AA1E-B0E52CCC70F6'
            });
            contacts.push({
                loadboard: 'TRUCKSTOP',
                name: 'Team HDQ',
                phone: '916-526-0262',
                email: 'heavyduty@rcglogistics.com',
                username: 'heavyduty@rcglogistics.com',
                external_id: '0D823063-3AF5-EB11-AAEA-065441B9C395'
            });
            contacts.push({
                loadboard: 'TRUCKSTOP',
                name: 'Team KMC',
                phone: '402-318-3314',
                email: 'kmc@rcglogistics.com',
                username: 'kmc@rcglogistics.com',
                external_id: '0C823063-3AF5-EB11-AAEA-065441B9C395'
            });
            contacts.push({
                loadboard: 'TRUCKSTOP',
                name: 'Team 190',
                phone: '916-573-6630',
                email: 'ship@rcglogistics.com',
                username: 'ship@rcglogistics.com',
                external_id: '333F0E7B-B555-E911-AA1E-B0E52CCC70F6'
            });
            contacts.push({
                loadboard: 'TRUCKSTOP',
                name: 'Team YMC',
                phone: '770-338-3583',
                email: 'ymc@rcglogistics.com',
                username: 'ymc@rcglogistics.com',
                external_id: '5162D7A8-FF12-EB11-AA57-BCE1060DB88B'
            });
            contacts.push({
                loadboard: 'TRUCKSTOP',
                name: 'Team 110',
                phone: '916-573-6599',
                email: 'teamlkq@rcglogistics.com',
                username: 'teamlkq@rcglogistics.com',
                external_id: 'BF298468-479E-EB11-AA57-BCE1060DB88B'
            });
            contacts.push({
                loadboard: 'TRUCKSTOP',
                name: 'Team FRT',
                phone: '916-573-6574',
                email: 'freight@rcglogistics.com',
                username: 'freight@rcglogistics.com',
                external_id: '0A823063-3AF5-EB11-AAEA-065441B9C395'
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
