console.log('SERVER IS STARTING!!! C:');

///// MODULES /////
const express = require(`express`);
const app = express();

require('dotenv').config(); // so we can access env vars (as process.env)
const router = require('./router');


///// CONSTANTS /////
const PORT = process.env.PORT || 3000;

///// MIDDLEWARE /////
app.use(express.json()); // parse JSON and place it in req.body

///// ROUTES /////
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));

app.get(`/`, (req, res) => res.send(`A change has ocurred!`) );
app.use(router);