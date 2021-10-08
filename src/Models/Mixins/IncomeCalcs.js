const currency = require('currency.js');

const mixin = {
    calculateEstimatedIncome()
    {
        this.estimatedIncome = currency(this.estimatedRevenue).subtract(currency(this.estimatedExpense));
    },
    calculateNetProfitMargin(totalRevenue, totalExpense)
    {
        let netProfitMargin = 0;
        const currencyTotalRevenue = currency(totalRevenue);
        const currencyTotalExpense = currency(totalExpense);
        if (currencyTotalRevenue.value != 0)
        {
            netProfitMargin = (currencyTotalRevenue.subtract(currencyTotalExpense)
            / currencyTotalRevenue) * 100;
        }
        return netProfitMargin.toFixed(2);
    }
};

module.exports = mixin;