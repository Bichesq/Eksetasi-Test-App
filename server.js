require('dotenv').config();
const express = require('express');
const path = require('path');
const axios = require('axios');

const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// change this to your deployed FastAPI requestor base URL
const REQUESTOR_BASE_URL = process.env.REQUESTOR_BASE_URL || 'http://localhost:8000';
const API_KEY = process.env.API_KEY;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// Check auth middleware
const requireAuth = (req, res, next) => {
    // Check if token exists in cookie
    if (!req.cookies.token) {
        return res.redirect('/signin');
    }
    next();
};

app.get('/', (req, res) => {
  if (req.cookies.token) {
      res.redirect('/request/new');
  } else {
      res.redirect('/signin');
  }
});

// Sign In Routes
app.get('/signin', (req, res) => {
    res.render('signin', { error: null, form: {}, apiKey: API_KEY });
});

app.post('/signin', async (req, res) => {
    try {
        const { username, password, apiKey } = req.body;
        
        console.log(`Authenticating user: ${username}`);
        
        const r = await axios.post(`${REQUESTOR_BASE_URL}/auth`, { 
            username, 
            password, 
            apiKey: apiKey || API_KEY
        });
        
        const token = r.data.access_token;
        console.log('Authentication successful, token received');
        
        // Store token in HTTP-only cookie
        res.cookie('token', token, { 
            httpOnly: true, 
            maxAge: 3600000,
            secure: process.env.NODE_ENV === 'production'
        });
        
        res.redirect('/request/new');
        
    } catch (err) {
        console.error('Login failed:', err.message);
        const detail = err.response?.data?.detail || err.message;
        res.render('signin', { error: detail, form: req.body, apiKey: req.body.apiKey });
    }
});

// health check
app.get('/health', async (req, res) => {
  try {
    const r = await axios.get(`${REQUESTOR_BASE_URL}/health`);
    res.render('health', { health: r.data });
  } catch (err) {
    res.render('health', { health: { status: 'error', detail: err.message } });
  }
});

// show new notification form (protected)
app.get('/request/new', requireAuth, (req, res) => {
  res.render('new_request', { errors: null, result: null, form: {} });
});

// handle submission
app.post('/request', requireAuth, async (req, res) => {
  console.log('--- Incoming Request ---');
  console.log('Form Body:', req.body);

  try {
    const body = {
      Application: req.body.Application,
      Recipient: req.body.Recipient,
      Subject: req.body.Subject || null,
      Message: req.body.Message,
      OutputType: req.body.OutputType,
      Date: req.body.Date || null,
      Time: req.body.Time || null,
      Interval: {
        Once: req.body.Once === 'on',
        Days: (Array.isArray(req.body.Days) ? req.body.Days : req.body.Days ? [req.body.Days] : []).map(Number),
        Weeks: (Array.isArray(req.body.Weeks) ? req.body.Weeks : req.body.Weeks ? [req.body.Weeks] : []).map(Number),
        Months: (Array.isArray(req.body.Months) ? req.body.Months : req.body.Months ? [req.body.Months] : []).map(Number),
        Years: (Array.isArray(req.body.Years) ? req.body.Years : req.body.Years ? [req.body.Years] : []).map(Number),
      },
      PhoneNumber: req.body.PhoneNumber || null,
      EmailAddresses: (req.body.EmailAddresses || '')
        .split(',')
        .map(e => e.trim())
        .filter(Boolean),
      PushToken: req.body.PushToken || null,
    };

    console.log('Converted Payload:', JSON.stringify(body, null, 2));

    const apiKey = req.body.ApiKey || API_KEY;
    const token = req.cookies.token; // Get token from cookie

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
    
    if (apiKey) {
        headers['X-API-Key'] = apiKey;
    }

    console.log('>>> Request Headers:', JSON.stringify(headers, null, 2));
    
    const r = await axios.post(`${REQUESTOR_BASE_URL}/request`, body, { headers });

    console.log('Success Response:', r.data);
    
    res.render('new_request', { errors: null, result: r.data, form: req.body });
  } catch (err) {
    console.error('Error encountered:', err.message);
    // If 401, redirect to login might be appropriate, or just show error
    if (err.response && err.response.status === 401) {
         // Clear cookie and render error asking to login
         res.clearCookie('token');
         return res.render('new_request', { errors: "Session expired. Please sign in again.", result: null, form: req.body });
    }
    
    if (err.response) {
      console.error('Error Response Data:', JSON.stringify(err.response.data, null, 2));
    }
    const detail = err.response?.data || err.message;
    res.render('new_request', { errors: detail, result: null, form: req.body });
  }
});

app.listen(PORT, () => {
  console.log(`UI listening on ${PORT}`);
});
