/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
/* eslint-disable padding-line-between-statements */
const context = require('../defaultContext');
const _ = require('lodash');
const axios = require('axios');
const AxiosMocker = require('axios-mock-adapter');
const mockDb = require('mock-knex');

const moxios = new AxiosMocker(axios);
const p = require('../payloads.json');
const r = require('../routes.json');

// mutate native functionality (uncomment to mute)
// console.log = jest.fn();

// eslint-disable-next-line no-console
console.warn = jest.fn();

// List of Classes
const Heroku = require('../../src/HerokuPlatformAPI');
const PG = require('../../src/PostGres');
const AccountService = require('../../src/Services/AccountService');

const spyOnDelete = jest.spyOn(moxios, 'onDelete');
const spyOnPost = jest.spyOn(moxios, 'onPost');
const spyOnGet = jest.spyOn(moxios, 'onGet');
const spyOnPut = jest.spyOn(moxios, 'onPut');
const spyOnPatch = jest.spyOn(moxios, 'onPatch');

// moxios mocks
moxios.onGet(r.herokuGetConfig).reply(200, p.herokuGetConfig);

// mock knex/pg
let db;

beforeAll(async () =>
{
    db = await PG.connect();

    mockDb.mock(db);
});

beforeEach(() =>
{
    // clear history and reset all calls
    moxios.resetHistory();

    jest.clearAllMocks();
});

describe('Classes', () =>
{
    it('empty test', () =>
    {
        // this is here because this file will throw errors without any tests
        expect(true).toBeTruthy();
    });

    describe('Account', () =>
    {
        beforeAll(() =>
        {
            const tracker = mockDb.getTracker();

            tracker.install();

            tracker.once('query', (query) =>
            {
                query.response(p.getAccountByTypeAndSearch);
            });
        });

        // it('search Account By Type', async () =>
        // {
        //     const res = await AccountService.searchByType('Client', 'LKQ');

        //     expect(res?.[0]).toMatchObject(p.getAccountByTypeAndSearch.rows[0]);
        // });
    });

});
