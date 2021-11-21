const router = require('express').Router();
const { dbQuery } = require('./../db');

router.post('/', async (req, res) => {
    const email = req.body.email;
    if (!email) {
        res.status(400).send('Bad request: missing email attribute');
        return;
    }

    // Create user in Users table
    let query = `INSERT INTO Users (Email) VALUES ('${email}');`;
    let createUserResult;
    try {
        createUserResult = await dbQuery(query);
    }
    catch (error) {
        res.status(400).send(error.sqlMessage || 'Error: Could not insert user');
        return;
    }
    
    // Create a root folder for user
    const userId = createUserResult.insertId;
    query = `INSERT INTO Folders (UserId, Name, Children) VALUES (${userId}, 'root', '[]');`;
    try {
        const createFolderResult = await dbQuery(query);
    } catch (error) {
        res.status(400).send(error.sqlMessage || 'Error: Could not create root folder for user');
        return;
    }

    res.status(200).send('User created!');
});

// TODO: Create a method to DELETE and EDIT user as well

module.exports = router;