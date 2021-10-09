/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
/* eslint-disable padding-line-between-statements */
<<<<<<< HEAD
=======
const { ExpiringAccessTokenCache } = require('@azure/core-http');
>>>>>>> staging
const IncomeCalcs = require('../src/Models/Mixins/IncomeCalcs');

describe('Tests the added functions in the mixin', () =>
{
    it('Should calculate the correct value for the profit margin', () =>
    {
        const orders = [
            {
                actualRevenue: 1962.23,
                actualExpense: 1423.99,
                expectedNetProfitMargin: '27.43'
            },
            {
                actualRevenue: 420,
                actualExpense: 69,
                expectedNetProfitMargin: '83.57'
            },
            {
                actualRevenue: null,
                actualExpense: 1423.99,
                expectedNetProfitMargin: '0.00'
            },
            {
                actualRevenue: 1962.23,
                actualExpense: null,
                expectedNetProfitMargin: '100.00'
            },
            {
                actualRevenue: 0,
                actualExpense: null,
                expectedNetProfitMargin: '0.00'
            },
            {
                actualRevenue: 0,
                actualExpense: '.99',
                expectedNetProfitMargin: '0.00'
            },
            {
                actualRevenue: null,
                actualExpense: null,
                expectedNetProfitMargin: '0.00'
            }
        ];

        for(const order of orders)
        {
            const res = IncomeCalcs.calculateNetProfitMargin(order.actualRevenue, order.actualExpense);
            expect(res).toBe(order.expectedNetProfitMargin);
        }
    });
});