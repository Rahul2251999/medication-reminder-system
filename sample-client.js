// sample-client.js - Example of how to trigger a medication reminder call
const axios = require('axios');

// Replace with your actual API endpoint
const API_ENDPOINT = 'http://localhost:3000/api/call';

// Function to trigger a medication reminder call
async function triggerMedicationReminder(phoneNumber) {
  try {
    console.log(`Triggering medication reminder for ${phoneNumber}...`);
    
    const response = await axios.post(API_ENDPOINT, {
      phoneNumber: phoneNumber
    });
    
    console.log('API Response:', response.data);
    console.log(`Call initiated with SID: ${response.data.callSid}`);
  } catch (error) {
    console.error('Error triggering medication reminder:', error.response?.data || error.message);
  }
}

// Example usage
if (require.main === module) {
  const phoneNumber = process.argv[2];
  
  if (!phoneNumber) {
    console.error('Please provide a phone number as an argument');
    console.error('Example: node sample-client.js +1234567890');
    process.exit(1);
  }
  
  triggerMedicationReminder(phoneNumber);
}

module.exports = {
  triggerMedicationReminder
};