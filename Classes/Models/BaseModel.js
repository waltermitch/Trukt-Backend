const { Model } = require('objection');
const Knex = require('knex');
const knexfile = require('../../knexfile');

const knex = Knex(knexfile());

Model.knex(knex);

class BaseModel extends Model
{
    static get modelPaths()
    {
        return [__dirname];
    }
}

module.exports = BaseModel;