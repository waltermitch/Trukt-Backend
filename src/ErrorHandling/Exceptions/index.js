const ApiError = require('./ApiError');
const ApplicationError = require('./ApplicationError');
const AuthenticationError = require('./AuthenticationError');
const DataConflictError = require('./DataConflictError');
const ExceptionCollection = require('./ExceptionCollection');
const MissingDataError = require('./MissingDataError');
const NotAllowedError = require('./NotAllowedError');
const NotFoundError = require('./NotFoundError');
const ValidationError = require('./ValidationError');

module.exports = {
    ApiError,
    ApplicationError,
    AuthenticationError,
    DataConflictError,
    ExceptionCollection,
    MissingDataError,
    NotAllowedError,
    NotFoundError,
    ValidationError
};