// get the logged in user, that is going ot be the authority

(async function ()
{
    try
    {
        let knex = require('knex');
        const knexfile = require('../knexfile');

        knex = knex(knexfile());
        let user;
        if (knex.client.config.connection instanceof Function)
        {
            const connection = await knex.client.config.connection();
            user = connection.user;
        }
        else
        {
            user = knex.client.config.connection.user;
        }

        await knex.raw(`
        CREATE SCHEMA IF NOT EXISTS rcg_tms AUTHORIZATION ${user};
        `);
        console.log('success');
        process.exit(0);
    }
    catch (err)
    {
        console.log(err);
        process.exit(1);
    }

})();