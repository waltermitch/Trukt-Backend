const { uuidRegex, salesforceIdRegex } = require('../Utils/Regexes');
const fieldMappings = require('./ModelFieldMappers.json');
const knexPostgis = require('knex-postgis');
const knexfile = require('../../knexfile');
const { parseDate } = require('../Utils');
const { Model } = require('objection');
const { types } = require('pg');
const Knex = require('knex');

const knex = Knex(knexfile());

const st = knexPostgis(knex);

Model.knex(knex);

const TIMESTAMPTZ_OID = 1184;
const TIMESTAMP_OID = 1114;
types.setTypeParser(TIMESTAMPTZ_OID, parseDate);
types.setTypeParser(TIMESTAMP_OID, parseDate);

class BaseModel extends Model
{
    static get st()
    {
        return st;
    }

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
    }

    async $beforeUpdate(options, context)
    {
        await super.$beforeUpdate(options, context);
    }

    setIndex(index)
    {
        if (!this['#id'])
        {
            this['#id'] = index;
        }
    }

    hasIndex()
    {
        return this['#id'] == undefined;
    }

    /**
     * links a model to the current instance
     * used for graph insert, doesnt do anything if model doesnt exist
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

    mapIndex(json)
    {
        if ('index' in json)
        {
            json['#id'] = json.index;
            delete json.index;
        }
        return json;
    }

    static validateId(id)
    {
        return uuidRegex.test(id) || salesforceIdRegex.test(id);
    }
}

module.exports = BaseModel;