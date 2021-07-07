const { Model } = require('objection');
const Knex = require('knex');
const knexfile = require('../../knexfile');
const fieldMappings = require('./ModelFieldMappers.json');

const knex = Knex(knexfile());

Model.knex(knex);

class BaseModel extends Model
{
    static get modelPaths()
    {
        return [__dirname];
    }

    /**
     * this is sending the object (into) to the external world
     */
    $formatJson(json)
    {
        json = super.$formatJson(json);
        for (const field of fieldMappings?.[this.constructor.name]?.hide?.external?.into || [])
        
            delete json[field];
        
        return json;
    }

    /**
     * this is making object (outa) from external source
     */
    $parseJson(json)
    {
        json = super.$parseJson(json);

        for (const field of fieldMappings?.[this.constructor.name]?.hide?.external?.out || [])

            delete json[field];

        return json;
    }

    /**
     * this is making model (outa) from database
     */
    $parseDatabaseJson(json)
    {
        json = super.$parseDatabaseJson(json);

        for (const field of fieldMappings?.[this.constructor.name]?.hide?.database?.outa || [])
        
            delete json[field];
        
        return json;
    }

    /**
     * this is sending the object (into) into the database
     */
    $formatDatabaseJson(json)
    {
        json = super.$formatDatabaseJson(json);
        for (const field of fieldMappings?.[this.constructor.name]?.hide?.database?.into || [])
        
            delete json[field];
        
        return json;
    }
}

module.exports = BaseModel;