const App = require('../Classes/App');

module.exports = () =>
{
    if (global.App)
        return;

    //make app global
    global.App = App;
}