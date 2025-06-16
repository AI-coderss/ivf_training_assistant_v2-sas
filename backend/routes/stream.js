const express = require("express");
const { createDidStream } = require("../services/did");
const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { agentId } = req.body;
    const data = await createDidStream(agentId);
    // returns { streamId, sdpOffer }
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
