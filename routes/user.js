const router = require('express').Router();
const { dbQuery } = require('./../db');

// Returns folderId of the root folder of the user. An 'email' and 'uid' query params are required.
// If the user did not exist, it will be created
router.get('/', async (req, res) => {
    const uid = req.query.uid;
    const email = req.query.email;

    if (!uid || !email) {
        res.status(400).send('Bad request: missing uid or email query param');
        return;
    }

    // See if user exists
    let selectUserResult;
    try {
        selectUserResult = await dbQuery(`SELECT * FROM Users WHERE UserId='${uid}'`);
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
            getRootResult = await dbQuery(`SELECT * FROM Folders WHERE ParentId=-1 AND UserId='${uid}'`);
        }
        catch (error) {
            res.status(500).send(`Error: Could not get user's root folder`);
            console.log(`Error: Could not get user's root folder (${error.sqlMessage})`);
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
            createUserResult = await dbQuery(`INSERT INTO Users (UserId, Email) VALUES ('${uid}', '${email}');`);
        }
        catch (error) {
            res.status(500).send('Error: Could not insert user. Email might already exist in DB');
            console.log(`Error: Could not insert user. Email might already exist in DB (${error.sqlMessage})`);
            return;
        }

        // And then create a root folder for that user
        let createFolderResult;
        try {
            createFolderResult = await dbQuery(`INSERT INTO Folders (UserId, Name, Children) VALUES (${uid}, 'root', '[]');`);
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