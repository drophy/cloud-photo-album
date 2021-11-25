console.log('SERVER IS STARTING!!! C:');

///// MODULES /////
const express = require(`express`);
const app = express();

require('dotenv').config(); // so we can access env vars (as process.env)
const router = require('./router');
const { dbConnection } = require('./db');


///// CONSTANTS /////
const PORT = process.env.PORT || 3000;

///// MIDDLEWARE /////
app.use(express.json()); // parse JSON and place it in req.body

///// ROUTES /////
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));

app.get(`/`, (req, res) => res.send(`Welcome to Cloud Photo Album's API!!! c:`) );
app.use(router);

// FOLDERS //
app.post('/create_folder', (req, res) => {
    const name = req.body.name;
    const userId = req.body.userId;
    const folderId = req.body.folderId; // id of parent folder

    query = `SELECT * FROM Folders WHERE FolderId = ${folderId}`;
    dbConnection.query(query, function(error, results, fields) {
        if (error) throw error;
        console.log(results);
        const folder = results[0];

        // Verify user owns the folder
        if(folder.UserId != userId) {
            res.status(400).send("Error: Folder doesn't belong to user");
            return;
        }

        // Create folder
        query = `INSERT INTO Folders (UserId, Name, Children) VALUES (${userId}, '${name}', '[]');`;
        dbConnection.query(query, function(error, results) {
            if (error) throw error;
            console.log(results);
            const newFolderId = 'F' + results.insertId;

            // Add new folder to children of parent
            let children = JSON.parse(folder.Children);
            children.push(newFolderId);

            query = `UPDATE Folders SET Children = '${JSON.stringify(children)}' WHERE FolderId = ${folderId}`;
            dbConnection.query(query, function(error, results) {
                if (error) throw error;
                console.log(results);

                // Inform request was successful
                res.status(200).send('Folder created');
            });
            // TODO: see if there's a better way of pushing to a JSON field
        });
    });
});

