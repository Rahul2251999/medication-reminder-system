// medication-reminder-system/index.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const twilio = require('twilio');
const winston = require('winston');
const VoiceResponse = twilio.twiml.VoiceResponse;

// Configure Winston logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Validate required environment variables
const requiredEnvVars = [
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_PHONE_NUMBER',
  'BASE_URL'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingEnvVars.length > 0) {
  logger.error('Missing required environment variables:', { missing: missingEnvVars });
  process.exit(1);
}


// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Configure middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Initialize Twilio client
let client;
try {
  client = new twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
} catch (error) {
  logger.error('Failed to initialize Twilio client:', { error: error.message });
  process.exit(1);
}

// Constants
const MESSAGES = {
  REMINDER: "Hello, this is a reminder from your healthcare provider to confirm your medications for the day. Please confirm if you have taken your Aspirin, Cardivol, and Metformin today.",
  VOICEMAIL: "We called to check on your medication but couldn't reach you. Please call us back or take your medications if you haven't done so.",
  SMS_FALLBACK: "We called to check on your medication but couldn't reach you. Please call us back or take your medications if you haven't done so.",
  THANK_YOU: "Thank you for your response. Have a good day.",
  NO_RESPONSE: "We didn't receive a response. Please remember to take your medications. Thank you."
};

// Basic test route
app.get('/', (req, res) => {
  res.json({
    status: 'running',
    endpoints: {
      call: '/api/call',
      logs: '/api/logs' // Bonus endpoint for call logs
    }
  });
});

// Validate phone number middleware
const validatePhoneNumber = (req, res, next) => {
  const { phoneNumber } = req.body;
  const phoneRegex = /^\+[1-9]\d{1,14}$/;
  
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return res.status(400).json({ error: 'Valid phone number is required' });
  }
  
  if (!phoneRegex.test(phoneNumber)) {
    return res.status(400).json({ 
      error: 'Phone number must be in E.164 format (e.g., +1234567890)' 
    });
  }
  
  next();
};

// REST API endpoint to trigger outgoing calls
app.post('/api/call', validatePhoneNumber, async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    logger.info('Initiating outbound call', { phoneNumber });
    
    const call = await client.calls.create({
      url: `${process.env.BASE_URL}/voice/outbound`,
      to: phoneNumber,
      from: process.env.TWILIO_PHONE_NUMBER,
      statusCallback: `${process.env.BASE_URL}/voice/status`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallbackMethod: 'POST',
      machineDetection: 'DetectMessageEnd',
      asyncAmd: true,
      record: true // Enable call recording for bonus feature
    });
    
    logger.info('Call initiated successfully', { 
      callSid: call.sid,
      phoneNumber,
      status: call.status 
    });
    
    res.json({ 
      success: true, 
      callSid: call.sid,
      recordingUrl: `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Recordings/${call.sid}`
    });
  } catch (error) {
    logger.error('Failed to initiate call', { 
      error: error.message,
      phoneNumber: req.body.phoneNumber 
    });
    res.status(500).json({ error: 'Failed to initiate call', details: error.message });
  }
});

// TwiML for outbound calls
app.post('/voice/outbound', (req, res) => {
  try {
    logger.info('Processing outbound call', { 
      callSid: req.body.CallSid,
      answeredBy: req.body.AnsweredBy 
    });
    
    const twiml = new VoiceResponse();
    
    if (req.body.AnsweredBy === 'machine_start' || req.body.AnsweredBy === 'machine_end_beep') {
      logger.info('Answering machine detected, leaving voicemail', { callSid: req.body.CallSid });
      twiml.say({ voice: 'alice' }, MESSAGES.VOICEMAIL);
    } else {
      logger.info('Human answered, delivering reminder', { callSid: req.body.CallSid });
      twiml.say({ voice: 'alice' }, MESSAGES.REMINDER);
      
      const gather = twiml.gather({
        input: 'speech',
        timeout: 10,
        speechTimeout: 'auto',
        action: '/voice/response',
        method: 'POST',
        language: 'en-US'
      });
      
      twiml.redirect('/voice/no-response');
    }
    
    logger.debug('Generated TwiML response', { 
      callSid: req.body.CallSid,
      twiml: twiml.toString() 
    });
    
    res.type('text/xml');
    res.send(twiml.toString());
  } catch (error) {
    logger.error('Error in outbound call handler', {
      error: error.message,
      callSid: req.body.CallSid
    });
    const twiml = new VoiceResponse();
    twiml.say({ voice: 'alice' }, 'We are experiencing technical difficulties. Please try again later.');
    res.type('text/xml');
    res.send(twiml.toString());
  }
});

// Handle speech response
app.post('/voice/response', (req, res) => {
  try {
    const patientResponse = req.body.SpeechResult || 'No speech detected';
    
    logger.info('Received patient response', {
      callSid: req.body.CallSid,
      response: patientResponse
    });
    
    const twiml = new VoiceResponse();
    twiml.say({ voice: 'alice' }, MESSAGES.THANK_YOU);
    twiml.hangup();
    
    res.type('text/xml');
    res.send(twiml.toString());
  } catch (error) {
    logger.error('Error handling speech response', {
      error: error.message,
      callSid: req.body.CallSid
    });
    const twiml = new VoiceResponse();
    twiml.say({ voice: 'alice' }, 'We are experiencing technical difficulties. Please try again later.');
    res.type('text/xml');
    res.send(twiml.toString());
  }
});

// Handle no response scenario
app.post('/voice/no-response', (req, res) => {
  try {
    logger.info('No response received from patient', { callSid: req.body.CallSid });
    
    const twiml = new VoiceResponse();
    twiml.say({ voice: 'alice' }, MESSAGES.NO_RESPONSE);
    twiml.hangup();
    
    res.type('text/xml');
    res.send(twiml.toString());
  } catch (error) {
    logger.error('Error handling no response', {
      error: error.message,
      callSid: req.body.CallSid
    });
    const twiml = new VoiceResponse();
    twiml.say({ voice: 'alice' }, 'We are experiencing technical difficulties. Please try again later.');
    res.type('text/xml');
    res.send(twiml.toString());
  }
});

// Handle incoming calls from patients
app.post('/voice/inbound', (req, res) => {
  try {
    logger.info('Received incoming call from patient', { 
      callSid: req.body.CallSid,
      from: req.body.From 
    });
    
    const twiml = new VoiceResponse();
    twiml.say({ voice: 'alice' }, MESSAGES.REMINDER);
    
    const gather = twiml.gather({
      input: 'speech',
      timeout: 10,
      speechTimeout: 'auto',
      action: '/voice/response',
      method: 'POST',
      language: 'en-US'
    });
    
    res.type('text/xml');
    res.send(twiml.toString());
  } catch (error) {
    logger.error('Error handling inbound call', {
      error: error.message,
      callSid: req.body.CallSid
    });
    const twiml = new VoiceResponse();
    twiml.say({ voice: 'alice' }, 'We are experiencing technical difficulties. Please try again later.');
    res.type('text/xml');
    res.send(twiml.toString());
  }
});

// Handle call status callbacks
app.post('/voice/status', async (req, res) => {
  try {
    const { CallSid, CallStatus, To, RecordingUrl } = req.body;
    
    logger.info('Call status update', {
      callSid: CallSid,
      status: CallStatus,
      to: To,
      recordingUrl: RecordingUrl
    });
    
    if (CallStatus === 'no-answer' || CallStatus === 'busy' || CallStatus === 'failed' || CallStatus === 'canceled') {
      logger.info('Sending SMS fallback', { callSid: CallSid, to: To });
      
      const message = await client.messages.create({
        body: MESSAGES.SMS_FALLBACK,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: To
      });
      
      logger.info('SMS fallback sent', {
        callSid: CallSid,
        messageSid: message.sid
      });
    }
    
    res.sendStatus(200);
  } catch (error) {
    logger.error('Error handling call status', {
      error: error.message,
      callSid: req.body.CallSid
    });
    res.sendStatus(500);
  }
});

// Bonus endpoint: Get call logs
app.get('/api/logs', async (req, res) => {
  try {
    // Get calls from Twilio
    const calls = await client.calls.list({
      limit: 50,
      status: req.query.status // optional status filter
    });

    // Format the response
    const formattedCalls = calls.map(call => ({
      callSid: call.sid,
      to: call.to,
      from: call.from,
      status: call.status,
      duration: call.duration,
      timestamp: call.dateCreated,
      recordingUrl: call.recordingUrl,
      direction: call.direction
    }));

    res.json({
      success: true,
      count: formattedCalls.length,
      calls: formattedCalls
    });
  } catch (error) {
    logger.error('Error fetching call logs', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch call logs', details: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// Start the server
app.listen(PORT, () => {
  logger.info('Server started', {
    port: PORT,
    baseUrl: process.env.BASE_URL,
    environment: process.env.NODE_ENV || 'development'
  });
});