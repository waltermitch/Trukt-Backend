const ORDER_TABLE_NAME = 'orders';
const JOB_TABLE_NAME = 'order_jobs';
const SCHEMA_NAME = 'rcg_tms';

exports.up = function (knex)
{
    let query = '';

    for (const tableName of [ORDER_TABLE_NAME, JOB_TABLE_NAME])
    {
        query += `
        ALTER TABLE ${SCHEMA_NAME}.${tableName}
        DROP COLUMN gross_profit_margin,
        ADD COLUMN gross_profit_margin numeric(5,2) GENERATED ALWAYS AS (GREATEST(-999.99,LEAST(999.99, (actual_revenue - actual_expense) / NULLIF(actual_revenue, 0) * 100))) STORED;
        `;
    }
    return knex.raw(query);
};

exports.down = function (knex)
{
    let query = '';

    for (const tableName of [ORDER_TABLE_NAME, JOB_TABLE_NAME])
    {
        query += `
        ALTER TABLE ${SCHEMA_NAME}.${tableName}
        DROP COLUMN gross_profit_margin,
        ADD COLUMN gross_profit_margin numeric(5,2) GENERATED ALWAYS AS ((actual_revenue - actual_expense) / NULLIF(actual_revenue, 0) * 100) STORED;
        `;
    }
    return knex.raw(query);
};
