const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const bodyParser = require('body-parser');
const path = require('path');
const dotenv = require('dotenv')
const account = require('./auth.json')
const bcrypt = require('bcrypt')
const admin = require('firebase-admin');
const session = require('express-session');
const saltRounds = 10

const app = express();

dotenv.config()
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

app.set('view engine', 'ejs');
app.use(session({
    secret: "Deepu",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}))

const url = 'mongodb+srv://DeepthiSri:deepu0405@cluster0.c0ewm.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
const dbName = 'complaintsDB';
let db;

(async () => {
    try {
        const client = await MongoClient.connect(url);
        console.log('Connected to Database...');
        db = client.db(dbName);
    } catch (err) {
        console.error('Failed to connect to MongoDB', err);
    }
})();



admin.initializeApp({
    credential: admin.credential.cert(account),
});

const firebaseDB = admin.firestore();

app.get("/signup", (req, res) => {
    res.render("signup", { error: "" });
});

app.post('/signup', async (req, res) => {
    const name = req.body.username;
    const email = req.body.email;
    const password = req.body.password;

    try {
        const user = await admin.auth().createUser({
            email: email,
            password: password,
            displayName: name,
        });

        const hashedPassword = await bcrypt.hash(password, saltRounds);
        await firebaseDB.collection("users").doc(user.uid).set({
            name: name,
            email: email,
            password: hashedPassword
        });
        
        req.session.userID = user.uid
        res.redirect("/");
    } catch (error) {
        res.render('signup', { error: error })
        
    }
});



app.get("/login", (req, res) => {
    res.render("login", { error: "" });
});

app.post("/login", async (req, res) => {
    try {
        const userRecord = await admin.auth().getUserByEmail(req.body.email);
        const userDetails = await firebaseDB.collection('users').doc(userRecord.uid).get();

        if (!userDetails.exists) {
            
            return res.render("/login", { error: "Invalid Credentials.." });
        }

        const userData = userDetails.data();
        const storedPassword = userData.password;

        const result = await bcrypt.compare(req.body.password, storedPassword);

        if (result) {
            
            req.session.userID = userRecord.uid
            res.redirect("/");
        } else {
            res.redirect("/login");
        }
    } catch (error) {
        console.error("Error during login:", error);
        res.render('login')
    }
});


app.get('/', async (req, res) => {
    try {
        const loginState = !!req.session.userID
        const complaintsCollection = db.collection('complaints');
        const complaints = await complaintsCollection.find({}).sort({ likes: -1 }).toArray();
        res.render('home', { complaints: complaints, loginState: loginState });
    } catch (err) {
        console.error('Error fetching complaints:', err);
        
    }
});

app.get('/submit-form', (req, res) => {
    res.render('form');
})

app.post('/submit-complaint', async (req, res) => {
    try {
        const complaintsCollection = db.collection('complaints');
        const complaint = {
            name: req.body.name,
            registerNo: req.body['register-no'],
            department: req.body.department,
            typeOfComplaint: req.body['type-of-complaint'],
            complaintText: req.body.complaint,
            likes: 0
        };
        
        await complaintsCollection.insertOne(complaint);
        
        res.redirect('/');
    } catch (err) {
        console.error('Error submitting complaint:', err);
        
    }
});


app.post('/liked',  async (req, res) => {
    const like = req.body.like;
    
    const complaintsCollection = db.collection('complaints');
    await complaintsCollection.updateOne({ _id: new ObjectId(like) }, { $inc: { likes: 1 } })
    complaints.likes = complaints.likes + 1;
    console.log(complaints)
    res.redirect('/')
})

app.get('/post/:id', async (req, res) => {
    const id = req.params.id
    try {
        const complaintsCollection = db.collection('complaints')
        const complaints = await complaintsCollection.findOne({ _id: new ObjectId(id) })
        
        res.render('post', { complaint: complaints })
    } catch (error) {
        console.error(error.message)
    }
})

app.post('/filter', async (req, res) => {
    const dept = req.body.deptValue;
    const loginState = !!req.session.userID
    let filteredData;
    try {
        const complaintsCollection = db.collection('complaints')
        const complaints = await complaintsCollection.find().toArray()
        if (dept === 'all') {
            filteredData = complaints
        } else {
            filteredData = complaints.filter((data) => data.department === dept)
        }
    } catch (error) {
        console.error(error.message)
    }
    res.render('home', { complaints: filteredData, loginState: loginState })
})

const PORT = 4000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}...`);
});
