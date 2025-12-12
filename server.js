require('dotenv').config();
const express = require('express');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// change this to your deployed FastAPI requestor base URL
const REQUESTOR_BASE_URL = process.env.REQUESTOR_BASE_URL || 'http://localhost:8000';
const API_KEY = process.env.API_KEY;

// Store JWT token in memory
let backendJwtToken = null;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get('/', (req, res) => {
  res.redirect('/request/new');
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

// show new notification form
app.get('/request/new', (req, res) => {
  res.render('new_request', { errors: null, result: null, form: {} });
});

// handle submission
app.post('/request', async (req, res) => {
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

    const sendRequest = async (token) => {
      const headers = {
        'Content-Type': 'application/json',
      };
      if (API_KEY) {
        headers['X-API-Key'] = API_KEY;
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      return await axios.post(`${REQUESTOR_BASE_URL}/request`, body, { headers });
    };

    let r;
    try {
      // First attempt with current token (if any) and API key
      r = await sendRequest(backendJwtToken);
    } catch (err) {
      // Check if unauthorized and we might have received a token to upgrade
      if (err.response && (err.response.status === 401 || err.response.status === 403)) {
        console.log('Received 401/403 - checking for JWT token update...');
        
        // Look for token in response headers or body
        // Adjust these paths based on actual backend behavior
        const newToken = err.response.headers['x-jwt-token'] || 
                       err.response.data?.token || 
                       err.response.data?.jwt;

        if (newToken) {
          console.log('New JWT token found. Retrying request...');
          backendJwtToken = newToken;
          // Retry with new token
          r = await sendRequest(backendJwtToken);
        } else {
          // No token found, rethrow existing error
          throw err;
        }
      } else {
        // Not an auth error we can handle, rethrow
        throw err;
      }
    }

    console.log('Success Response:', r.data);
    
    res.render('new_request', { errors: null, result: r.data, form: req.body });
  } catch (err) {
    console.error('Error encountered:', err.message);
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
