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
        {
            delete json[field];
        }

        delete json['#id'];
        delete json['#ref'];
        delete json['#dbRef'];

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

    async $beforeInsert(context)
    {
        await super.$beforeInsert(context);
        if (typeof this.setCreatedBy === 'function')
            this.setCreatedBy();
    }

    async $beforeUpdate(options, context)
    {
        await super.$beforeUpdate(options, context);
        if (typeof this.setUpdatedBy === 'function')
            this.setUpdatedBy();
    }

    setIndex(index)
    {
        if (!this['#id'])
        {
            this['#id'] = index;
        }
    }

    /**
     * links a model to the current instance
     * used for graph insert, doesnt do anything is model doesnt exist
     * @param {string} relName
     * @param {Model} model
     */
    graphLink(relName, model)
    {
        if (model && model.constructor.idColumn)
        {
            const link = { '#dbRef': model[model.constructor.idColumn] };
            if (typeof this[relName] === 'object')
            {
                Object.assign(this[relName], link);
            }
            else
            {
                this[relName] = link;
            }
        }
    }
}

module.exports = BaseModel;