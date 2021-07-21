const table_name = 'equipment_types';

const equipmentTypes = [
    { name: 'Open' },
    { name: 'Enclosed' },
    { name: 'Van' },
    { name: 'Flatbed' },
    { name: 'Step Deck' },
    { name: 'Lowboy / RGN' },
    { name: 'Reefer' },
    { name: 'Flatbed/Van/Reefer' },
    { name: 'Power Only' },
    { name: 'Driveaway' },
    { name: 'Box Truck' },
    { name: 'Lowboy' },
    { name: 'RGN' },
    { name: 'Hot Shot' },
    { name: 'Sprinter Van' },
    { name: 'Van/Reefer' },
    { name: 'Van/Flatbed/Step Deck ' },
    { name: 'Flatbed/Step Deck' },
    { name: 'Van w/Team' },
    { name: 'Van / Sprinter Van / Box Truck' },
    { name: 'Flatbed / Step Deck / Hotshot' },
    { name: 'Flatbed / Step Deck / Hotshot / Lowboy / RGN' }
];

exports.up = function (knex)
{
    return knex.schema.withSchema('rcg_tms')
        .createTable(table_name, (table) =>
        {
            table.increments('id', { primaryKey: true }).notNullable();
            table.string('name', 48).notNullable().unique();
            table.boolean('is_deprecated').defaultsTo(false).comment('checked when this is deleted but still needs to be used for the older records');
        }).then(() =>
        {
            return knex(table_name).insert(equipmentTypes);
        });

};

exports.down = function (knex)
{
    return knex.schema.withSchema('rcg_tms').dropTableIfExists(table_name);
};
