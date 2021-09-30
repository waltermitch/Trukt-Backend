const table_name = 'invoice_bill_payment_methods';

exports.up = function (knex)
{

    return knex.raw(`
    ALTER TABLE rcg_tms.${table_name}
    ADD COLUMN external_id varchar unique,
    ADD COLUMN external_source varchar`);
};

exports.down = function (knex)
{
    return knex.raw(`
    ALTER TABLE rcg_tms.${table_name}
    DROP COLUMN external_id,
    DROP COLUMN external_source`);
};
