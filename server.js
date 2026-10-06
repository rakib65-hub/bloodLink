const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));
app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type"]
}));

// --- Static Files & Root Route Setup ---
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});
// ---------------------------------------

// 1. MongoDB Connection (Cloud Atlas)
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://rakib:rakib12345@cluster0.tsnzfso.mongodb.net/BloodLinkDB?retryWrites=true&w=majority';

mongoose.connect(MONGO_URI)
.then(() => console.log("MongoDB Connected Successfully!"))
.catch(err => console.log("Database connection error: ", err));

// 2. Donor Schema & Model
const donorsSchema = new mongoose.Schema({
    fullname: { type: String, required: true },
    bloodgroup: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
    location: { type: String, required: true },
    password: { type: String, required: true },
    profilePic: { type: String },
    age: { type: String },
    gender: { type: String },
    weight: { type: String },
    medicalNote: { type: String }
});
const Donor = mongoose.model('Donor', donorsSchema);

// 3. Register API Route
app.post('/api/register', async (req, res) => {
    try {
        const { fullname, bloodgroup, phone, location, password, age, gender, weight, medicalNote } = req.body;
        
        const existingDonor = await Donor.findOne({ phone });
        if (existingDonor) {
            return res.status(400).json({ message: "Ei phone namber-e already account ache!" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newDonor = new Donor({
            fullname,
            bloodgroup,
            phone,
            location,
            password: hashedPassword,
            age,
            gender,
            weight,
            medicalNote
        });

        await newDonor.save();
        res.status(201).json({ message: "Registration successful!" });
    } catch (err) {
        console.error("Register Error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// 4. Login API Route
app.post('/api/login', async (req, res) => {
    try {
        const { phone, password } = req.body;
        const donor = await Donor.findOne({ phone });
        if (!donor) {
            return res.status(400).json({ message: "Ei phone namber diye kono account paoa jayni!" });
        }

        const isMatch = await bcrypt.compare(password, donor.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Vul password dewa hoyeche!" });
        }

        res.status(200).json({ 
            message: "Login safol hoyeche!", 
            donor: { 
                fullname: donor.fullname, 
                bloodgroup: donor.bloodgroup,
                phone: donor.phone,
                location: donor.location,
                profilePic: donor.profilePic,
                age: donor.age,
                gender: donor.gender,
                weight: donor.weight,
                medicalNote: donor.medicalNote
            } 
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// 5. Update Donor Profile Route
app.put('/api/update-donor', async (req, res) => {
    try {
        const { phone, fullname, profilePic, bloodgroup, location, password, age, gender, weight, medicalNote } = req.body;
        
        let donor = await Donor.findOne({ phone });
        if (!donor) {
            return res.status(404).json({ message: "Donor not found" });
        }

        donor.fullname = fullname || donor.fullname;
        donor.profilePic = profilePic || donor.profilePic;
        donor.bloodgroup = bloodgroup || donor.bloodgroup;
        donor.location = location || donor.location;
        donor.age = age || donor.age;
        donor.gender = gender || donor.gender;
        donor.weight = weight || donor.weight;
        donor.medicalNote = medicalNote || donor.medicalNote;
        
        if (password && password.trim() !== "") {
            donor.password = await bcrypt.hash(password, 10);
        }

        await donor.save();
        res.status(200).json({ 
            message: "Profile updated successfully", 
            donor: {
                fullname: donor.fullname,
                bloodgroup: donor.bloodgroup,
                phone: donor.phone,
                location: donor.location,
                profilePic: donor.profilePic,
                age: donor.age,
                gender: donor.gender,
                weight: donor.weight,
                medicalNote: donor.medicalNote
            }
        });
   } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// 6. Get All Donors API
app.get('/api/donors', async (req, res) => {
    try {
        const donors = await Donor.find({}, '-password');
        res.status(200).json(donors);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// --- Blood Request Schema & Model ---
const bloodRequestSchema = new mongoose.Schema({
    bloodgroup: { type: String, required: true },
    urgency: { type: String, required: true },
    bagsNeeded: { type: Number, required: true },
    bagsCollected: { type: Number, default: 0 },
    hospital: { type: String, required: true },
    department: { type: String },
    location: { type: String, required: true },
    phone: { type: String, required: true },
    contactPerson: { type: String, required: true },
    clinicalSummary: { type: String, required: true },
    status: { type: String, default: 'Active' },
    createdAt: { type: Date, default: Date.now }
});
const BloodRequest = mongoose.model('BloodRequest', bloodRequestSchema);

// Post Blood Request API
app.post('/api/request-blood', async (req, res) => {
    try {
        const newRequest = new BloodRequest(req.body);
        await newRequest.save();
        res.status(201).json({ message: "Blood request submitted successfully!" });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Get Active Blood Requests API (All)
app.get('/api/blood-requests', async (req, res) => {
    try {
        const requests = await BloodRequest.find({ status: 'Active' }).sort({ createdAt: -1 });
        res.status(200).json(requests);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Get Specific User's Blood Requests API
app.get('/api/my-blood-requests/:phone', async (req, res) => {
    try {
        const userPhone = req.params.phone;
        const requests = await BloodRequest.find({ phone: userPhone, status: 'Active' }).sort({ createdAt: -1 });
        res.status(200).json(requests);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Update Fulfilled Bags API
app.put('/api/update-request/:id', async (req, res) => {
    try {
        const { bagsCollected } = req.body;
        const request = await BloodRequest.findById(req.params.id);
        
        if (!request) {
            return res.status(404).json({ message: "Request not found" });
        }

        request.bagsCollected = Number(bagsCollected);
        
        if (request.bagsCollected >= request.bagsNeeded) {
            request.status = 'Fulfilled';
        }

        await request.save();
        res.status(200).json({ message: "Request updated successfully!", request });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// --- Fallback Route for HTML Pages (Fixes Case Sensitivity & Direct Links) ---
app.get('/:page', (req, res) => {
    let pageName = req.params.page;
    // Jodi extension na thake, tahole .html add kore nibe
    if (!pageName.includes('.')) {
        pageName += '.html';
    }
    const filePath = path.join(__dirname, pageName);
    res.sendFile(filePath, (err) => {
        if (err) {
            res.status(404).send("Page not found!");
        }
    });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});