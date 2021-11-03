const BaseModel = require('../BaseModel');

const authors = ['createdBy', 'updatedBy', 'deletedBy'];

function setBy(obj, field, user)
{
    if (!obj[field])
    {
        const guid = typeof user === 'object' ? user.guid : user;
        obj[field] = guid;
    }
}

const RecordAuthorMixin =
{
    setCreatedBy(user)
    {
        setBy(this, 'createdByGuid', user);
    },
    setUpdatedBy(user)
    {
        setBy(this, 'updatedByGuid', user);
    },
    setDeletedBy(user)
    {
        setBy(this, 'deletedByGuid', user);
    }
};

/**
 *  Helper function to create relationships for the model class when needed
 *
 *  @returns an object with relationship names
 */
function AuthorRelationMappings(tableName)
{
    const User = require('../User');
    const relationships = {};
    for (const author of authors)

        relationships[author] = {
            relation: BaseModel.BelongsToOneRelation,
            modelClass: User,
            join: {
                from: `${tableName}.${author}Guid`,
                to: 'rcgTms.tmsUsers.guid'
            }
        };

    return relationships;
}

function isNotDeleted(tableName)
{
    return {
        isNotDeleted(query)
        {
            query.whereNot(`${tableName}.is_deleted`, true);
        }
    };
}

module.exports = {
    RecordAuthorMixin,
    AuthorRelationMappings,
    isNotDeleted
};