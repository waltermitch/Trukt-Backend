/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
/* eslint-disable padding-line-between-statements */
require('../tools/start')();
const context = require('./defaultContext');
const _ = require('lodash');
const axios = require('axios');
const AxiosMocker = require('axios-mock-adapter');

const moxios = new AxiosMocker(axios);
const p = require('./payloads.json');
const r = require('./routes.json');

// mutate native functionality (uncomment to mute)
// console.log = jest.fn();

// eslint-disable-next-line no-console
console.warn = jest.fn();

// List of Classes
const Heroku = require('../Classes/HerokuPlatformAPI');

const spyOnDelete = jest.spyOn(moxios, 'onDelete');
const spyOnPost = jest.spyOn(moxios, 'onPost');
const spyOnGet = jest.spyOn(moxios, 'onGet');
const spyOnPut = jest.spyOn(moxios, 'onPut');
const spyOnPatch = jest.spyOn(moxios, 'onPatch');

beforeAll(async () => { });

beforeEach(() =>
{
    // clear history and reset all calls
    moxios.resetHistory();

    jest.clearAllMocks();
});

describe('Classes', () =>
{
    describe('Heroku API', () =>
    {
        it('Refresh Access Token', async () =>
        {
            // listen
            moxios.onPost(r.herokuIdentityAPI).replyOnce(200, p.herokuGetToken);

            // do call
            const res = await Heroku.getNewToken();

            expect(spyOnPost).toHaveBeenCalledWith(r.herokuIdentityAPI);
            expect(res.status).toBe(200);
        });

        it('Get Config', async () =>
        {
            moxios.onGet(r.herokuGetConfig).replyOnce(200, p.herokuGetConfig);

            const res = await Heroku.getConfig();

            expect(res).toMatchObject(p.herokuGetConfig);
            expect(res).toHaveProperty('DATABASE_URL');
            expect(spyOnGet).toHaveBeenCalledWith(r.herokuGetConfig);
        });
    });
});
