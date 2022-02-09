const ApiError = require('./ApiError');
const AuthenticationError = require('./AuthenticationError');
const DataConflictError = require('./DataConflictError');
const MissingDataError = require('./MissingDataError');
const NotAllowedError = require('./NotAllowedError');
const NotFoundError = require('./NotFoundError');
const ValidationError = require('./ValidationError');

module.exports = {
    ApiError,
    AuthenticationError,
    DataConflictError,
    MissingDataError,
    NotAllowedError,
    NotFoundError,
    ValidationError
};