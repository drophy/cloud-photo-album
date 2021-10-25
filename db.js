const mysql = require('mysql');
const util = require('util');
const config = require('./config.json');

const dbConnection = mysql.createConnection({
    host: config.host,
    user: config.user,
    port: config.port,
    password: config.password,
    database: config.database
});

// node native promisify
// https://stackoverflow.com/questions/44004418/node-js-async-await-using-with-mysql
const dbQuery = util.promisify(dbConnection.query).bind(dbConnection);

module.exports = {dbConnection, dbQuery};