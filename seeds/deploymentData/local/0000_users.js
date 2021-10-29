
exports.seed = async function (knex)
{
    return knex('rcg_tms.tms_users').insert({
        guid: process.env.SYSTEM_USER,
        name: 'TMS System',
        email: 'system@rcglogistics.com'
     });
};
