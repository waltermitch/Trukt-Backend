const orderTable = 'orders';
const jobTable = 'order_jobs';

exports.up = function(knex)
{
    return knex.schema.withSchema('rcg_tms').table(orderTable, (table) =>
    {
        table.decimal('gross_profit_margin', 5, 2).default(0);
    }).table(jobTable, (table) =>
    {
        table.decimal('gross_profit_margin', 5, 2).default(0);
    }).then(() =>
    {
        return knex.schema.withSchema('rcg_tms').alterTable(orderTable, (table) =>
        {
            table.dropColumn('actual_income');
            table.dropColumn('estimated_income');
            table.decimal('estimated_revenue', 15, 2).alter().unsigned().default(0).comment('This is the estimated amount of money a client would be paying for the order');
            table.decimal('estimated_expense', 15, 2).alter().unsigned().default(0).comment('This is the estimated amount of money it will cost to hire a vendor/carrier to complete the order');
            table.decimal('actual_revenue', 15, 2).alter().unsigned().default(0).comment('This is the actual amount of money that the order brings into the company');
            table.decimal('actual_expense', 15, 2).alter().unsigned().default(0).comment('This is the actual amoutn of money that was spent on this order');
        }).table(jobTable, (table) =>
        {
            table.dropColumn('actual_income');
            table.dropColumn('estimated_income');
            table.decimal('estimated_expense', 15, 2).alter().unsigned().default(0).comment('This is the estimated amount of money it will cost to hire a vendor/carrier to complete the order');
            table.decimal('estimated_revenue', 15, 2).alter().unsigned().default(0).comment('This is the estimated amount of money a client would be paying for the order');
            table.decimal('actual_revenue', 15, 2).alter().unsigned().default(0).comment('This is the actual amount of money that the job brings into the company');
            table.decimal('actual_expense', 15, 2).alter().unsigned().default(0).comment('This is the actual amount of money that was spent on this job');
        }).then(() =>
        {
            return knex.raw(`
                ALTER TABLE rcg_tms.${orderTable}
                ADD estimated_income numeric(15,2) 
                GENERATED ALWAYS AS (rcg_tms.${orderTable}.estimated_revenue - rcg_tms.${orderTable}.estimated_expense) STORED;
                
                ALTER TABLE rcg_tms.${orderTable}
                ADD actual_income numeric(15,2) 
                GENERATED ALWAYS AS (rcg_tms.${orderTable}.actual_revenue - rcg_tms.${orderTable}.actual_expense) STORED;

                ALTER TABLE rcg_tms.${jobTable}
                ADD estimated_income numeric(15,2) 
                GENERATED ALWAYS AS (rcg_tms.${jobTable}.estimated_revenue - rcg_tms.${jobTable}.estimated_expense) STORED;

                ALTER TABLE rcg_tms.${jobTable}
                ADD actual_income numeric(15,2) 
                GENERATED ALWAYS AS (rcg_tms.${jobTable}.actual_revenue - rcg_tms.${jobTable}.actual_expense) STORED;
                `);
        });
    });
};

exports.down = function(knex)
{
    return knex.schema.withSchema('rcg_tms').alterTable(orderTable, (table) =>
    {
        table.dropColumn('gross_profit_margin');
        table.dropColumn('estimated_income');
        table.dropColumn('actual_income');
    }).alterTable(jobTable, (table) =>
    {
        table.dropColumn('gross_profit_margin');
        table.dropColumn('estimated_income');
        table.dropColumn('actual_income');
    }).then(() =>
    {
        return knex.schema.withSchema('rcg_tms').alterTable(orderTable, (table) =>
        {
            table.decimal('estimated_expense', 15, 2).alter().unsigned().comment('This is the estimated amount of money it will cost to hire a vendor/carrier to complete the order');
            table.decimal('estimated_revenue', 15, 2).alter().unsigned().comment('This is the estimated amount of money a client would be paying for the order');
            table.decimal('estimated_income', 15, 2).unsigned().comment('This is the difference between the estimated revenue and expense');
            table.decimal('actual_revenue', 15, 2).alter().unsigned().comment('This is the actual amount of money that the order brings into the company');
            table.decimal('actual_expense', 15, 2).alter().unsigned().comment('This is the actual amount of money that was spent on this order');
            table.decimal('actual_income', 15, 2).comment('This the the actual income / profit made on the order');
        }).table(jobTable, (table) =>
        {
            table.decimal('estimated_expense', 15, 2).alter().unsigned().comment('This is the estimated amount of money it will cost to hire a vendor/carrier to complete the order');
            table.decimal('estimated_revenue', 15, 2).alter().unsigned().comment('This is the estimated amount of money a client would be paying for the order');
            table.decimal('estimated_income', 15, 2).unsigned().comment('This is the difference between the estimated revenue and expense');
            table.decimal('actual_revenue', 15, 2).alter().unsigned().comment('This is the actual amount of money that the job brings into the company');
            table.decimal('actual_expense', 15, 2).alter().unsigned().comment('This is the actual amount of money that was spent on this job');
            table.decimal('actual_income', 15, 2).comment('This the the actual income / profit made on the job');
        });
    });
};
