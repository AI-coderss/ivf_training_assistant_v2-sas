const express = require("express");
const { ragQuery } = require("../services/rag");
const { sendDidText } = require("../services/did");
const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { agentId, streamId, text } = req.body;

    // 1) RAG: retrieve + generate
    const answer = await ragQuery(text);

    // 2) Send answer to D-ID avatar
    await sendDidText(agentId, streamId, answer);

    res.json({ answer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

