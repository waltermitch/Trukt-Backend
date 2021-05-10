const { decrypt } = require('./crypt');
const App = require('../Classes/App');

<<<<<<< HEAD
module.exports = () => {
	if (global.App) return;

	// make app global

	global.App = App;
};
=======
(module.exports = () =>
{
    if (global.App)
        return;

    // make app global
    global.App = App;

    // decrypt env goodies
    global.config = decrypt()[`${process.env.ENV}`];
})();
>>>>>>> dev
