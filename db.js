const mysql = require('mysql');
const util = require('util');

// ENV //
require('dotenv').config();

const dbConnection = mysql.createConnection({
    host: process.env.host,
    user: process.env.user,
    port: process.env.port,
    password: process.env.password,
    database: process.env.database
});

// node native promisify
// https://stackoverflow.com/questions/44004418/node-js-async-await-using-with-mysql
const dbQuery = util.promisify(dbConnection.query).bind(dbConnection);

module.exports = {dbConnection, dbQuery};