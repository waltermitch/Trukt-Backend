const currency = require('currency.js');

const mixin = {
    calculateEstimatedIncome()
    {
        this.estimatedIncome = currency(this.estimatedRevenue).subtract(currency(this.estimatedExpense));
    }
};

module.exports = mixin;