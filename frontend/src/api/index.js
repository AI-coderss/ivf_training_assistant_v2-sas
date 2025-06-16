// frontend/src/api/index.js
import axios from "axios";

const api = axios.create({
  baseURL: process.env.REACT_APP_BACKEND_URL + "/api", 
  // e.g. http://localhost:4000/api
});

export function createStream(agentId) {
  return api
    .post("/stream", { agentId })
    .then((r) => r.data);
}

export function postSdp(agentId, streamId, sdpAnswer) {
  return api.post("/sdp", { agentId, streamId, sdpAnswer });
}

export function chat(agentId, streamId, text) {
  return api
    .post("/chat", { agentId, streamId, text })
    .then((r) => r.data);
}
