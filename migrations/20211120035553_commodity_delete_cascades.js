const SCHEMA_NAME = 'rcg_tms';
const COMMODITY_TABLE = 'commodities';
const STOPLINKS_TABLE = 'order_stop_links';
const LINELINKS_TABLE = 'invoice_bill_line_links';
const LINES_TABLE = 'invoice_bill_lines';
exports.up = function (knex)
{
    return knex.schema.withSchema(SCHEMA_NAME)
        .table(STOPLINKS_TABLE, (table) =>
        {
            table.dropForeign('commodity_guid');
            table.foreign('commodity_guid')
                .references('guid')
                .inTable(COMMODITY_TABLE)
                .onDelete('CASCADE');
        })
        .table(LINES_TABLE, (table) =>
        {
            table.dropForeign('commodity_guid');
            table.foreign('commodity_guid')
                .references('guid')
                .inTable(COMMODITY_TABLE)
                .onDelete('CASCADE');
        })
        .table(LINELINKS_TABLE, (table) =>
        {
            for (const line of ['line1_guid', 'line2_guid'])
            {
                table.dropForeign(line);
                table.foreign(line)
                    .references('guid')
                    .inTable(LINES_TABLE)
                    .onDelete('CASCADE');

            }
        });
};

exports.down = function (knex)
{

    return knex.schema.withSchema(SCHEMA_NAME)
        .table(STOPLINKS_TABLE, (table) =>
        {
            table.dropForeign('commodity_guid');
            table.foreign('commodity_guid')
                .references('guid')
                .inTable(COMMODITY_TABLE);
        })
        .table(LINES_TABLE, (table) =>
        {
            table.dropForeign('commodity_guid');
            table.foreign('commodity_guid')
                .references('guid')
                .inTable(COMMODITY_TABLE);
        })
        .table(LINELINKS_TABLE, (table) =>
        {
            for (const line of ['line1_guid', 'line2_guid'])
            {
                table.dropForeign(line);
                table.foreign(line)
                    .references('guid')
                    .inTable(LINES_TABLE);

            }
        });
};
