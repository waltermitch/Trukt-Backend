const { decrypt } = require('./crypt');
const App = require('../Classes/App');

(module.exports = () =>
{
    if (global.App)
        return;

    // make app global
    global.App = App;

    // decrypt env goodies
    global.config = decrypt()[ `${process.env.ENV}` ];
})();
