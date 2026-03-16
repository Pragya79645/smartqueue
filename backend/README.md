# AI Queue Load Balancer - Backend API

## 🚀 Features

- **Real-time Queue Management**: Track and update queue data from CV detection
- **Staff Management**: CRUD operations for staff with skills and availability
- **AI-Powered Allocation**: Optimize staff allocation using OR-Tools (Python integration)
- **WhatsApp Alerts**: Automated notifications for rush hours, staff assignments, and support requests
- **Historical Analytics**: Queue statistics and historical data analysis

## 📋 Prerequisites

- Node.js >= 18.0.0
- MongoDB >= 6.0
- npm >= 9.0.0

## 🔧 Installation

1. **Clone and navigate to backend:**
```bash
cd backend
```

2. **Install dependencies:**
```bash
npm install
```

3. **Configure environment:**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Start MongoDB:**
```bash
# Windows
net start MongoDB

# Linux/Mac
sudo systemctl start mongod
```

5. **Run the server:**
```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

The server will start on `http://localhost:5000`

## 📚 API Documentation

### 🟢 Queue Routes (`/api/queue`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/live` | Get current live queue data for all counters |
| POST | `/update` | Update queue data for a single counter |
| POST | `/update/batch` | Batch update for multiple counters |
| GET | `/history` | Get historical queue data |
| GET | `/stats` | Get queue statistics |
| DELETE | `/history` | Clean old data (maintenance) |

**Example - Update Queue:**
```json
POST /api/queue/update
{
  "counterId": 1,
  "queueSize": 12,
  "predictedSize": 15,
  "predictionTime": 15,
  "averageWaitTime": 36
}
```

### 🟢 Staff Routes (`/api/staff`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Get all staff (filterable by availability/skills) |
| GET | `/:id` | Get single staff member |
| POST | `/` | Create new staff member |
| PUT | `/:id` | Update staff member |
| PATCH | `/:id/availability` | Update staff availability |
| PATCH | `/:id/skills` | Update staff skills |
| PATCH | `/:id/assign` | Assign staff to counter |
| DELETE | `/:id` | Delete staff member |
| GET | `/available/count` | Get count of available staff |

**Example - Create Staff:**
```json
POST /api/staff
{
  "staffId": "S001",
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "skills": ["general", "cashier"],
  "shiftStart": "09:00",
  "shiftEnd": "17:00"
}
```

### 🟢 Allocation Routes (`/api/allocate`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/now` | Generate optimized allocation recommendation |
| GET | `/recommendation` | Get latest allocation recommendation |
| POST | `/:id/apply` | Apply allocation (assign staff to counters) |
| GET | `/history` | Get allocation history |
| GET | `/stats` | Get allocation statistics |
| GET | `/requirement` | Calculate staff requirement |

**Example - Generate Allocation:**
```json
POST /api/allocate/now
{
  "constraints": {
    "maxStaffPerCounter": 2,
    "skillMatching": true
  }
}
```

### 🟢 WhatsApp Routes (`/api/whatsapp`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/alert/rush` | Send rush alert for high queue |
| POST | `/alert/allocation` | Send staff allocation notifications |
| POST | `/alert/peak` | Send peak rush warning |
| POST | `/alert/support` | Send support needed alert |
| POST | `/send` | Send custom message |
| POST | `/broadcast` | Broadcast message to all staff |
| GET | `/test` | Test WhatsApp connection |

**Example - Send Rush Alert:**
```json
POST /api/whatsapp/alert/rush
{
  "counterId": 3,
  "recipients": ["+1234567890", "+0987654321"]
}
```

## 🗄️ Database Models

### QueueRecord
- `counterId`: Counter number
- `queueSize`: Current number of people
- `predictedSize`: Predicted queue size
- `averageWaitTime`: Average wait time in minutes
- `status`: normal | busy | critical
- `timestamp`: Record timestamp

### Staff
- `staffId`: Unique staff identifier
- `name`: Staff name
- `email`: Email address
- `phone`: Phone number (for WhatsApp)
- `skills`: Array of skills (general, loan, account, cashier, etc.)
- `availability`: available | busy | break | offline
- `currentCounter`: Assigned counter number
- `performanceScore`: Performance score (0-100)
- `shiftStart/End`: Shift timings

### Allocation
- `allocations`: Array of staff-to-counter assignments
- `totalScore`: Optimization score
- `predictedLoad`: Predicted queue load data
- `status`: pending | active | completed
- `timestamp`: Creation timestamp

## 🔌 Integration with Python AI Engine

The backend integrates with Python services for:

1. **OR-Tools Optimization** (`optimizeService.js`)
  - Endpoint: `POST http://localhost:8001/optimize`
   - Returns optimal staff allocation

2. **LSTM Prediction** (`predictionService.js`)
  - Endpoint: `POST http://localhost:8001/predict`
   - Returns queue size predictions

*Note: Falls back to mock algorithms if Python service is unavailable*

## 🔐 Environment Variables

```env
PORT=5000                    # Server port
NODE_ENV=development         # Environment
MONGO_URI=mongodb://...      # MongoDB connection string
PYTHON_API_URL=http://...    # Python AI service URL
WHATSAPP_TOKEN=...          # WhatsApp Business API token
WHATSAPP_PHONE_ID=...       # WhatsApp phone number ID
LOG_LEVEL=info              # Logging level
```

## 📊 Logging

Logs are stored in the `logs/` directory:
- `combined.log`: All logs
- `error.log`: Error logs only

View logs in real-time:
```bash
npm run logs:view
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test
```

## 🚀 Deployment

### Production Checklist

1. Set `NODE_ENV=production` in `.env`
2. Use a process manager (PM2 recommended)
3. Setup MongoDB with authentication
4. Configure firewall rules
5. Setup HTTPS/SSL
6. Configure WhatsApp Business API properly

### PM2 Deployment

```bash
npm install -g pm2
pm2 start src/server.js --name queue-balancer
pm2 save
pm2 startup
```

## 🔄 Architecture Flow

```
CV Detection (YOLO) 
    ↓
POST /api/queue/update
    ↓
MongoDB (QueueRecord)
    ↓
POST /api/allocate/now
    ↓
Python AI Service (OR-Tools)
    ↓
POST /api/allocate/:id/apply
    ↓
Update Staff Assignments
    ↓
POST /api/whatsapp/alert/allocation
    ↓
WhatsApp Notifications
```

## 🛠️ Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB + Mongoose
- **HTTP Client**: Axios
- **Logging**: Winston
- **Security**: Helmet
- **WhatsApp**: Meta Business API

## 📞 Support

For issues and questions, please check the documentation or create an issue in the repository.

## 📄 License

MIT License - See LICENSE file for details
