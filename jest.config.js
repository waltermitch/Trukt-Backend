// this stupid shit also has to be in root directory
module.exports = {
    setupFiles: [ '<rootDir>/jest/env.js' ],
    setupFilesAfterEnv: [ '<rootDir>/jest/jest.setup.js' ],
    preset: '@shelf/jest-mongodb'
};
