const table_name = 'tms_users';

exports.up = function (knex)
{
    return knex.raw(`
        ALTER TABLE ${table_name} 
        ADD COLUMN email varchar(255)`);
};

exports.down = function (knex)
{
    return knex.raw(`
        ALTER TABLE ${table_name} 
        DROP COLUMN email`);
};
