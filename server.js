const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']); 

const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const app = express();
const port = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// --- CLOUDINARY CONFIGURATION ---
cloudinary.config({ 
    cloud_name: 'dhv16wfu3', 
    api_key: '777451833433194', 
    api_secret:'ZS5wKWSCWLbDnalC_7HQ0RBWtGA' 
});

// --- MONGODB CLOUD CONNECTION ---
const MONGO_URI = "mongodb+srv://jbitancs:%40jom032600@helpstarteducationfound.vdoadsk.mongodb.net/helpstart_db?appName=HelpStartEducationFoundation";

mongoose.connect(MONGO_URI)
    .then(() => {
        console.log("🔌 Connected na ang server sa cloud MongoDB Database!");
        seedInitialUsers(); 
    })
    .catch(err => console.error("❌ Error sa pag-connect sa database:", err));


// --- MONGODB SCHEMAS & MODELS ---
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});
const User = mongoose.model('User', userSchema);

const draftSchema = new mongoose.Schema({
    user: { type: String, required: true },
    title: { type: String, default: "Untitled Folder Draft" }, 
    cloudinaryUrl: { type: String, required: true },
    cloudinaryPublicId: { type: String, required: true },
    canvasWidth: { type: Number },
    canvasHeight: { type: Number },
    textLayers: { type: Array, default: [] },
    savedAt: { type: Date, default: Date.now }
});
const Draft = mongoose.model('Draft', draftSchema);

const historySchema = new mongoose.Schema({
    username: { type: String, required: true },
    action: { type: String, required: true }, 
    url: { type: String },                    
    timestamp: { type: Date, default: Date.now }
});
const History = mongoose.model('History', historySchema);


// --- SYSTEM INITIAL SEEDING ---
async function seedInitialUsers() {
    try {
        const mgaUser = [
            { username: 'Jbitancs', password: 'jom032600' }, 
            { username: 'Analyn', password: 'admin123' },                    
            { username: 'Denmike', password: 'staff123' },             
            { username: 'Iyah', password: 'staff123' },
            { username: 'Anna', password: 'admin123' },
            // 👇 ADD YOUR NEW USER HERE 👇
            { username: 'Jumong', password: 'newuser123' },
            { username: 'Sister Calim', password: 'newuse123' },
            { username: 'Sister Soleno', password: 'password123' }           
        ];
        for (const u of mgaUser) {
            await User.findOneAndUpdate(
                { username: u.username }, { password: u.password }, { upsert: true, returnDocument: 'after'}
            );
        }
        console.log("👥 Accounts synchronized with cloud server standard indices.");
    } catch (err) { console.error("❌ Error sa user syncing:", err); }
}


// --- ROUTES & API ENDPOINTS ---

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// LOGIN ENTRY
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const foundUser = await User.findOne({ username: username, password: password });
        if (foundUser) { res.send({ success: true }); } 
        else { res.status(401).send({ success: false, message: "Mali ang login details." }); }
    } catch (err) { res.status(500).send({ success: false, error: err.message }); }
});

// KUKUNIN ANG MGA LOGS
app.get('/api/history', async (req, res) => {
    try {
        const logs = await History.find().sort({ timestamp: -1 }).limit(10);
        res.send(logs);
    } catch (err) { res.status(500).send({ success: false, error: err.message }); }
});


// ==========================================
//           DRAFT CORE IMPLEMENTATION
// ==========================================

app.get('/api/drafts/all', async (req, res) => {
    try {
        const listahan = await Draft.find().sort({ savedAt: -1 });
        res.send(listahan);
    } catch (err) { res.status(500).send({ error: err.message }); }
});

app.get('/api/draft/get/:id', async (req, res) => {
    try {
        const data = await Draft.findById(req.params.id);
        if (data) res.send({ success: true, data });
        else res.status(404).send({ success: false, message: "Draft not found." });
    } catch (err) { res.status(500).send({ success: false, error: err.message }); }
});

app.post('/api/drafts/save', async (req, res) => {
    const { draftId, user, title, backgroundImage, canvasWidth, canvasHeight, textLayers } = req.body;
    
    try {
        let finalUrl = backgroundImage;
        let finalPublicId = "";
        
        if (backgroundImage && backgroundImage.startsWith('data:')) {
            console.log(`⏳ Nag-uupload ng draft background image ni ${user} sa Cloudinary...`);
            const uploadRes = await cloudinary.uploader.upload(backgroundImage, {
                folder: "helpstart_drafts",
                quality: "auto"
            });
            finalUrl = uploadRes.secure_url;
            finalPublicId = uploadRes.public_id;
        }

        let savedDraft;

        if (draftId && mongoose.Types.ObjectId.isValid(draftId)) {
            const existingDraft = await Draft.findById(draftId);
            if (existingDraft) {
                if (finalPublicId && existingDraft.cloudinaryPublicId) {
                    await cloudinary.uploader.destroy(existingDraft.cloudinaryPublicId);
                }
                
                existingDraft.textLayers = textLayers;
                if(finalPublicId) {
                    existingDraft.cloudinaryUrl = finalUrl;
                    existingDraft.cloudinaryPublicId = finalPublicId;
                }
                existingDraft.savedAt = Date.now();
                savedDraft = await existingDraft.save();
                console.log(`🔄 Draft id ${draftId} ni ${user} ay matagumpay na na-overwrite (updated)!`);
            }
        } 
        
        if(!savedDraft) {
            savedDraft = await Draft.create({
                user: user,
                title: title || "Untitled Folder Draft",
                cloudinaryUrl: finalUrl,
                cloudinaryPublicId: finalPublicId,
                canvasWidth: canvasWidth,
                canvasHeight: canvasHeight,
                textLayers: textLayers
            });
            console.log(`💾 Bagong hiwalay na draft record ang nabuo para kay ${user}.`);
        }

        res.send({ success: true, draftId: savedDraft._id });
    } catch (error) {
        res.status(500).send({ success: false, message: error.message });
    }
});

app.post('/api/drafts/update-title', async (req, res) => {
    const { id, title } = req.body;
    try {
        const draft = await Draft.findByIdAndUpdate(id, { title: title }, { new: true });
        if (draft) {
            res.send({ success: true, message: "Pamagat ng folder ay pinalitan!" });
        } else {
            res.status(404).send({ success: false, message: "Draft folder block not found." });
        }
    } catch (err) {
        res.status(500).send({ success: false, error: err.message });
    }
});

app.use('/api/drafts/delete', async (req, res) => {
    if (req.method !== 'DELETE') return res.status(405).end();
    const { id, publicId } = req.body;
    try {
        if(publicId) {
            await cloudinary.uploader.destroy(publicId);
        }
        await Draft.findByIdAndDelete(id);
        res.send({ success: true });
    } catch (error) {
        res.status(500).send({ success: false, message: error.message });
    }
});


// ==========================================
//    IDINAGDAG NA UPLOAD CONTRACT ENDPOINT
// ==========================================

app.post('/api/upload-contract', async (req, res) => {
    const { file, user } = req.body;

    if (!file) {
        return res.status(400).send({ success: false, message: "Walang file data na natanggap." });
    }

    try {
        console.log(`⏳ Nag-uupload ng final contract si ${user} sa Cloudinary...`);
        
        // 1. I-upload ang Final Image sa Cloudinary
        const uploadRes = await cloudinary.uploader.upload(file, {
            folder: "helpstart_final_contracts",
            quality: "auto"
        });

        // 2. I-save sa History Database para lumabas sa "Recent Activity"
        await History.create({
            username: user || "Unknown User",
            action: "downloaded and saved the contract", // ✅ Pinalitan ng English
            url: uploadRes.secure_url
        });

        console.log(`✅ Matagumpay na nai-upload ang kontrata!`);

        // 3. Ibalik ang successful URL sa Frontend
        res.send({ 
            success: true, 
            message: "Matagumpay na nai-save sa Cloudinary!",
            url: uploadRes.secure_url 
        });

    } catch (error) {
        console.error("❌ Upload error:", error);
        res.status(500).send({ success: false, message: error.message });
    }
});


app.listen(port, () => console.log(`🚀 Node.js Backend Engine running on http://localhost:${port}`));