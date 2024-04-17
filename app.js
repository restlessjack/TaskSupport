const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const indexRoutes = require('./routes/index');
const userRoutes = require('./routes/users');


const app = express();
const path = require('path');

// Set the view engine to ejs
app.set('view engine', 'ejs');

// Set the directory where the views (templates) are located
app.set('views', path.join(__dirname, 'views'));



const port = process.env.PORT || 3000;

mongoose.connect('mongodb://localhost:27017/mydatabase', {
   
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/', indexRoutes);
app.use('/users', userRoutes);

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
