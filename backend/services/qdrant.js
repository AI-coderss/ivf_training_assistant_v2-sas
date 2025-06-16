const { QdrantClient } = require("@qdrant/js-client-rest");

const client = new QdrantClient({
  url: process.env.QDRANT_HOST,
  apiKey: process.env.QDRANT_API_KEY
});
module.exports = client;
