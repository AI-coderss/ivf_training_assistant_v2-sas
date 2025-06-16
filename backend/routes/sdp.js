const express = require("express");
const { sendDidSdp } = require("../services/did");
const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { agentId, streamId, sdpAnswer } = req.body;
    await sendDidSdp(agentId, streamId, sdpAnswer);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
