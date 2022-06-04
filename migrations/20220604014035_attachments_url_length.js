const TABLE_NAME = 'attachments';

exports.up = function (knex)
{
    return knex.raw(`
        ALTER TABLE ${TABLE_NAME}
        ALTER COLUMN url TYPE VARCHAR(2048)
    `);

};

exports.down = function (knex)
{
    return knex.raw(`
        ALTER TABLE ${TABLE_NAME}
        ALTER COLUMN url TYPE VARCHAR(255)
    `);
};
