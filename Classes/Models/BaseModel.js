const { Model } = require('objection');

class BaseModel extends Model
{
    static get modelPaths()
    {
        return [__dirname];
    }
}

module.exports = BaseModel;