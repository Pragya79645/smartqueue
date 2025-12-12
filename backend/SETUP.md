# 🚀 Quick Setup Guide

## Step 1: Install Dependencies

```bash
cd backend
npm install
```

## Step 2: Setup Environment

```bash
# Copy the example environment file
copy .env.example .env

# Edit .env with your settings (MongoDB URI, etc.)
```

## Step 3: Start MongoDB

```powershell
# Windows - Start MongoDB service
net start MongoDB

# Or start MongoDB manually
mongod --dbpath="C:\data\db"
```

## Step 4: Start the Server

```bash
# Development mode (auto-reload)
npm run dev

# Production mode
npm start
```

The API will be available at: **http://localhost:5000**

## Step 5: Test the API

Open your browser and visit:
- Health check: http://localhost:5000/health
- API info: http://localhost:5000/

## 📋 Quick Test Endpoints

### Create a Staff Member
```bash
curl -X POST http://localhost:5000/api/staff ^
  -H "Content-Type: application/json" ^
  -d "{\"staffId\":\"S001\",\"name\":\"John Doe\",\"email\":\"john@example.com\",\"phone\":\"+1234567890\",\"skills\":[\"general\",\"cashier\"]}"
```

### Update Queue Data
```bash
curl -X POST http://localhost:5000/api/queue/update ^
  -H "Content-Type: application/json" ^
  -d "{\"counterId\":1,\"queueSize\":10}"
```

### Get Live Queue
```bash
curl http://localhost:5000/api/queue/live
```

### Get All Staff
```bash
curl http://localhost:5000/api/staff
```

### Generate Allocation
```bash
curl -X POST http://localhost:5000/api/allocate/now ^
  -H "Content-Type: application/json"
```

## 🔍 Troubleshooting

### MongoDB Connection Error
- Ensure MongoDB is running
- Check MONGO_URI in .env
- Default: `mongodb://localhost:27017/queue-balancer`

### Port Already in Use
- Change PORT in .env file
- Default: 5000

### Python AI Service Not Available
- Backend will use mock algorithms
- This is normal for Phase 2
- Python service will be added in Phase 3

## 📁 Project Structure

```
backend/
├── src/
│   ├── controllers/      # Request handlers
│   ├── models/          # MongoDB schemas
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   ├── utils/           # Utilities (DB, Logger)
│   ├── app.js           # Express app
│   └── server.js        # Server entry point
├── logs/                # Log files
├── package.json         # Dependencies
└── .env                 # Configuration
```

## ✅ Next Steps

1. **Test all API endpoints** using the provided curl commands
2. **Connect to Frontend** (already built in /frontend)
3. **Build Phase 3**: Python AI Engine (YOLO + LSTM + OR-Tools)
4. **Setup WhatsApp Business API** for real notifications

## 🎯 API Summary

| Feature | Endpoints | Status |
|---------|-----------|--------|
| Queue Management | 6 endpoints | ✅ Complete |
| Staff Management | 9 endpoints | ✅ Complete |
| Allocation | 6 endpoints | ✅ Complete |
| WhatsApp Alerts | 7 endpoints | ✅ Complete |

**Total: 28 API Endpoints**

Ready to handle:
- Real-time queue updates from CV detection
- Staff CRUD operations
- AI-powered staff allocation
- Automated WhatsApp notifications

🎉 **Phase 2 Backend API is Complete!**
