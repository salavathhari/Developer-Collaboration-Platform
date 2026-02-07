const ApiError = require("../utils/ApiError");

const callAi = async ({ prompt, provider }) => {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    throw new ApiError(500, "AI_API_KEY is not set");
  }

  const model = process.env.AI_MODEL || "gpt-4o-mini";

  if (provider === "openai") {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: prompt,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new ApiError(502, `AI provider error: ${text}`);
    }

    const data = await response.json();
    const output = data.output?.[0]?.content?.[0]?.text || "";
    return output;
  }

  if (provider === "gemini") {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new ApiError(502, `AI provider error: ${text}`);
    }

    const data = await response.json();
    const output = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return output;
  }

  if (provider === "local") {
    const baseUrl = process.env.AI_LOCAL_URL || "http://localhost:11434";
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model,
        prompt,
        stream: false,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new ApiError(502, `AI provider error: ${text}`);
    }

    const data = await response.json();
    return data.response || "";
  }

  throw new ApiError(400, "Unsupported AI provider");
};

module.exports = {
  callAi,
};
