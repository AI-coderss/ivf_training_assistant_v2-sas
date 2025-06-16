// backend/services/did.js

const axios = require("axios");
const DID_BASE = "https://api.d-id.com";

// Build the Authorization header using Basic auth with your API key
// D-ID expects: Authorization: Basic API_USERNAME:API_PASSWORD (no Base64) :contentReference[oaicite:0]{index=0}
const AUTH_HEADER = { Authorization: `Basic ${process.env.D_ID_API}` };

/**
 * Create a new D-ID WebRTC stream for the given agent.
 * Returns an object: { streamId, sdpOffer } on success.
 */
async function createDidStream(agentId) {
  try {
    const res = await axios.post(
      `${DID_BASE}/talks/streams`,
      { agentId },
      { headers: AUTH_HEADER }
    );
    return res.data; // { streamId, sdpOffer }
  } catch (err) {
    console.error(
      "D-ID create stream error:",
      err.response?.status,
      err.response?.data || err.message
    );
    throw new Error(
      "Failed to create D-ID stream: " +
        JSON.stringify(err.response?.data || err.message)
    );
  }
}

/**
 * Send the browser’s SDP answer back to D-ID to complete the handshake.
 */
async function sendDidSdp(agentId, streamId, sdpAnswer) {
  try {
    await axios.post(
      `${DID_BASE}/agents/${agentId}/streams/${streamId}/sdp`,
      { sdpAnswer },
      { headers: AUTH_HEADER }
    );
  } catch (err) {
    console.error(
      "D-ID SDP error:",
      err.response?.status,
      err.response?.data || err.message
    );
    throw new Error(
      "Failed to send SDP to D-ID: " +
        JSON.stringify(err.response?.data || err.message)
    );
  }
}

/**
 * Send a chat message (text) to the D-ID avatar over the given stream.
 */
async function sendDidText(agentId, streamId, text) {
  try {
    await axios.post(
      `${DID_BASE}/agents/${agentId}/chat/${streamId}`,
      { text },
      { headers: AUTH_HEADER }
    );
  } catch (err) {
    console.error(
      "D-ID chat error:",
      err.response?.status,
      err.response?.data || err.message
    );
    throw new Error(
      "Failed to send chat to D-ID: " +
        JSON.stringify(err.response?.data || err.message)
    );
  }
}

module.exports = {
  createDidStream,
  sendDidSdp,
  sendDidText,
};

