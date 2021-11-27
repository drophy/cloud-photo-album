const router = require('express').Router();
const { dbQuery } = require('./../db');

// Returns folderId of the root folder of the user. An 'email' and 'userId' query params are required.
// If the user did not exist, it will be created
router.get('/', async (req, res) => {
    const userId = req.query.userId;
    const email = req.query.email;

    if (!userId || !email) {
        res.status(400).send('Bad request: missing userId or email query param');
        return;
    }

    // See if user exists
    let selectUserResult;
    try {
        selectUserResult = await dbQuery(`SELECT * FROM Users WHERE UserId='${userId}'`);
    }
    catch (error) {
        res.status(500).send('Error: Could not verify if user exists');
        console.log(`Error: Could not verify if user exists (${error.sqlMessage})`);
        return;
    }

    // If it does, figure out root folder id
    if(selectUserResult.length > 0)
    {
        let getRootResult;
        try {
            getRootResult = await dbQuery(`SELECT * FROM Folders WHERE ParentId=-1 AND UserId='${userId}'`);
        }
        catch (error) {
            res.status(500).send(`Error: Could not get user's root folder`);
            console.log(`Error: Could not get user's root folder (${error.sqlMessage})`);
            return;
        }
        if(getRootResult.length < 1) {
            res.status(500).send(`Error: Could not find user's root folder`);
            return;
        }
        const rootFolder = getRootResult[0];
        res.status(200).send({folderId: rootFolder.FolderId});
    }
    else
    {
        // Else, we'll create the user
        let createUserResult;
        try {
            createUserResult = await dbQuery(`INSERT INTO Users (UserId, Email) VALUES ('${userId}', '${email}');`);
        }
        catch (error) {
            res.status(500).send('Error: Could not insert user. Email might already exist in DB');
            console.log(`Error: Could not insert user. Email might already exist in DB (${error.sqlMessage})`);
            return;
        }

        // And then create a root folder for that user
        let createFolderResult;
        try {
            createFolderResult = await dbQuery(`INSERT INTO Folders (UserId, Name, Children) VALUES ('${userId}', 'root', '[]');`);
        } catch (error) {
            res.status(500).send('Error: Could not create root folder for user');
            console.log(`Error: Could not create root folder for user (${error.sqlMessage})`);
            return;
        }
        
        // Return folder id
        res.status(200).send({folderId: createFolderResult.insertId});
    }
});

module.exports = router;