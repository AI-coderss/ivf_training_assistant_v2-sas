const axios = require("axios");
const qdrant = require("./qdrant");

/**
 * Performs a retrieval-augmented generation:
 * 1) Embed the user text
 * 2) Search Qdrant for top-K similar chunks
 * 3) Build prompt context
 * 4) Invoke OpenAI to complete the answer
 */
async function ragQuery(userText) {
  // 1. Embed the user query
  let embedding;
  try {
    const embedRes = await axios.post(
      "https://api.openai.com/v1/embeddings",
      { model: "text-embedding-ada-002", input: userText },
      { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` } }
    );
    embedding = embedRes.data.data[0].embedding;
  } catch (err) {
    console.error(
      "OpenAI embedding error:",
      err.response?.status,
      err.response?.data || err.message
    );
    throw new Error(
      "Failed to embed query: " +
        JSON.stringify(err.response?.data || err.message)
    );
  }

  // 2. Search Qdrant for relevant chunks
  let searchResult;
  try {
    const res = await qdrant.search(process.env.QDRANT_COLLECTION, {
      vector: embedding,
      limit: 5,
    });
    searchResult = res.result;
  } catch (err) {
    console.error(
      "Qdrant search error:",
      err.message || err
    );
    throw new Error(
      "Failed to retrieve from Qdrant: " + err.message
    );
  }

  // 3. Concatenate the retrieved contexts
  const context = searchResult
    .map((r) => r.payload.text)
    .join("\n---\n");

  // 4. Generate the final answer with OpenAI
  try {
    const compRes = await axios.post(
      "https://api.openai.com/v1/completions",
      {
        model: "gpt-3.5-turbo",
        prompt: `Context:\n${context}\n\nUser: ${userText}\nAssistant:`,
        max_tokens: 200,
      },
      { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` } }
    );
    return compRes.data.choices[0].text.trim();
  } catch (err) {
    console.error(
      "OpenAI completion error:",
      err.response?.status,
      err.response?.data || err.message
    );
    throw new Error(
      "OpenAI completion failed: " +
        JSON.stringify(err.response?.data || err.message)
    );
  }
}

module.exports = { ragQuery };

