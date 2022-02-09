const TABLE_NAME = 'loadboard_contacts';
const SCHEMA_NAME = 'rcg_tms';
exports.up = function(knex)
{
  return knex.schema.withSchema(SCHEMA_NAME).table(TABLE_NAME, table =>
  {
    table.boolean('is_active').default(false);
  });
};

exports.down = function(knex)
{
    return knex.schema.withSchema(SCHEMA_NAME).table(TABLE_NAME, table =>
    {
        table.dropColumn('is_active');
    });
  
};
