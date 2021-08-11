const table_name = 'salesforce.account';

exports.up = function (knex)
{
    return knex.raw(`
    ALTER TABLE ${table_name}
    ADD COLUMN is_synced_in_super BOOLEAN`);
};

exports.down = function (knex)
{
    return knex.raw(`
    ALTER TABLE ${table_name}
    DROP COLUMN is_synced_in_super`);
};
