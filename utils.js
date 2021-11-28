const { dbQuery } = require('./db');

// Does the query to the DB. If requested, verifies result is not empty (useful for SELECTs). 
// Returns an object with a suggested 'status' and a 'data' property (null if there is an error)
async function queryDatabase(query, errorMessage="There was a problem when trying to access the database", verifyLength=false) {
    let result;
    try {
        result = await dbQuery(query)
    } catch (error) {
        console.log('-E- Error: ' + errorMessage);
        console.log(error.sqlMessage || error);
        return {data: null, status: 500};
    }
    
    if(verifyLength && (!result || result.length < 1))  {
        console.log('-E- Error: ' + errorMessage + '(the DB returned 0 results for the query)');
        return {data: null, status: 400};
    }

    return {data: result, status: 200};
}

const Utils = { queryDatabase };

module.exports = Utils;