const BaseModel = require('../BaseModel');

const authors = ['createdBy', 'updatedBy', 'deletedBy'];
const RecordAuthorMixin =
{

    setCreatedBy()
    {
        if (!this.createdByGuid)
            this.createdByGuid = process?.domain?.req?.session?.userGuid;

    },

    setUpdatedBy()
    {
        if (!this.createdByGuid)
            this.updatedByGuid = process?.domain?.req?.session?.userGuid;

    },

    setDeletedBy()
    {
        if (!this.deletedByGuid)
            this.deletedByGuid = process?.domain?.req?.session?.userGuid;
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

module.exports = {
    RecordAuthorMixin,
    AuthorRelationMappings
};