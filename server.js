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

    const apiKey = req.body.ApiKey || API_KEY;

    const sendRequest = async (token) => {
      const headers = {
        'Content-Type': 'application/json',
      };
      if (apiKey) {
        headers['X-API-Key'] = apiKey;
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        console.log('>>> Adding JWT to Authorization header');
      } else {
        console.log('>>> No JWT available for this request (using API Key only)');
      }
      console.log('>>> Request Headers:', JSON.stringify(headers, null, 2));
      return await axios.post(`${REQUESTOR_BASE_URL}/request`, body, { headers });
    };

    let r;
    try {
      // First attempt with current token (if any) and API key
      r = await sendRequest(backendJwtToken);
      
      // Check for token upgrade in successful response
      if (r.data && r.data.access_token) {
        console.log('<<< New JWT token received in response. Updating stored token.');
        backendJwtToken = r.data.access_token;
      } else {
        console.log('<<< No new JWT token in response.');
      }
      
    } catch (err) {
      // If error is 401 (Unauthorized) and we had a token, try one more time without the token (using API key)
      if (err.response && err.response.status === 401 && backendJwtToken) {
        console.log('401 Unauthorized received. Token might be expired. Retrying with API Key...');
        backendJwtToken = null; // Clear invalid token
        try {
           r = await sendRequest(null);
           // If successful, update token if new one provided
           if (r.data && r.data.access_token) {
             console.log('Retry successful. New JWT token received.');
             backendJwtToken = r.data.access_token;
           }
        } catch (retryErr) {
           // If retry fails, throw the original error or the new one
           console.error('Retry failed:', retryErr.message);
           throw retryErr;
        }
      } else {
        // Not a 401 or no token usage, just throw
        // Check if we might have received a token in the error response (edge case)
        if (err.response && err.response.data && err.response.data.access_token) {
             console.log('JWT token found in error response (unusual but handled).');
             backendJwtToken = err.response.data.access_token;
        }
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
