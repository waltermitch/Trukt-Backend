const TABLE_NAME = 'tms_users';

exports.up = function (knex)
{
    return knex.raw(`
        ALTER TABLE ${TABLE_NAME} 
        ADD COLUMN email varchar(255)`);
};

exports.down = function (knex)
{
    return knex.raw(`
        ALTER TABLE ${TABLE_NAME} 
        DROP COLUMN email`);
};
