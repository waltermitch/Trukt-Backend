const table_name = 'salesforce.account';

exports.up = function (knex)
{
    return knex.raw(`
    ALTER TABLE ${table_name}
    ADD COLUMN is_synced_in_super BOOLEAN
    
    ALTER VIEW salesforce.accounts as select is_synced_in_super as is_synced_in_super from ${table_name},`);
};

exports.down = function (knex)
{
    return knex.raw(`
    ALTER TABLE ${table_name}
    DROP COLUMN is_synced_in_super`);
};
