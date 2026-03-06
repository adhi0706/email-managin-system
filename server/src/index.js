import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import adminRoutes from './routes/admin.js';
import clientRoutes from './routes/clients.js';
import emailRoutes from './routes/emails.js';
import logsRoutes from './routes/logs.js';

dotenv.config();

// Nodemon restart trigger
const app = express();
app.use(express.json());
app.use(cors());

// Mount routers
app.use('/api/admin', adminRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/logs', logsRoutes);

// Test route
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'API is running' });
});

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/email-system';

mongoose.connect(MONGO_URI).then(() => {
    console.log('Connected to MongoDB successfully!');
    // If not running in a Vercel serverless environment, start listening
    if (!process.env.VERCEL) {
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    }
}).catch((error) => {
    console.error("MongoDB connection error:", error);
});

export default app;
