# Medication Reminder System

A voice-driven medication reminder system that uses Twilio to make automated calls to patients and capture their responses regarding medication adherence.

## Features

- Automated voice calls to patients using Text-to-Speech (TTS)
- Speech-to-Text (STT) capture of patient responses
- Voicemail support with answering machine detection
- SMS fallback for missed calls
- Call recording and logging
- Detailed console logging with Winston
- RESTful API for triggering calls and viewing logs

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- Twilio account with:
  - Account SID
  - Auth Token
  - Twilio phone number
- ngrok (for local development)

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/medication-reminder-system.git
   cd medication-reminder-system
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the example environment file and update with your values:
   ```bash
   cp .env.example .env
   ```
   Then edit `.env` with your actual credentials:
   ```
   TWILIO_ACCOUNT_SID=your_account_sid
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_PHONE_NUMBER=your_twilio_phone_number
   BASE_URL=your_ngrok_url_or_production_url
   PORT=3000
   ```

## Local Development Setup

1. Start ngrok to create a tunnel to your local server:
   ```bash
   ngrok http 3000
   ```

2. Copy the ngrok HTTPS URL and update your `.env` file's `BASE_URL`.

3. Start the development server:
   ```bash
   npm run dev
   ```

## Usage

### Making a Call

Send a POST request to `/api/call` with a phone number:

```bash
curl -X POST http://localhost:3000/api/call \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+1234567890"}'
```

### Viewing Call Logs

Get the call history by sending a GET request to `/api/logs`:

```bash
curl http://localhost:3000/api/logs
```

Optional: Filter by status:
```bash
curl http://localhost:3000/api/logs?status=completed
```

### Call Flow

1. System calls the patient
2. If answered by human:
   - Plays medication reminder message
   - Records patient's spoken response
   - Thanks patient and ends call
3. If answered by machine:
   - Leaves voicemail message
4. If unanswered:
   - Sends SMS fallback message

### Logs

- Call logs are written to `combined.log`
- Error logs are written to `error.log`
- Console output includes structured logging
- Call history available via `/api/logs` endpoint

## API Endpoints

- `POST /api/call` - Trigger an outbound call
- `GET /api/logs` - View call history
- `POST /voice/outbound` - Handle outbound call flow (Twilio webhook)
- `POST /voice/response` - Handle patient's speech response
- `POST /voice/no-response` - Handle no response scenario
- `POST /voice/inbound` - Handle incoming patient calls
- `POST /voice/status` - Handle call status updates

## Error Handling

The system includes comprehensive error handling:
- Input validation for phone numbers
- Twilio client initialization checks
- Environment variable validation
- Structured error logging
- Graceful error responses

## Security

- API keys and sensitive data are stored in environment variables
- Phone numbers are validated before processing
- Error messages are sanitized for production
- Example environment file provided as `.env.example`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

ISC 