const ApiError = require("../utils/ApiError");
// const fetch = require("node-fetch"); // Use native global fetch in Node 18+

const callAi = async ({ prompt, provider }) => {
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL || "gpt-3.5-turbo";
  
  // Auto-detect provider if not specified
  const effectiveProvider = provider || (apiKey ? "openai" : "mock");

  if (effectiveProvider === "mock") {
      await new Promise(r => setTimeout(r, 1500));
      return `[AI Simulated Response]\n\nBased on your request, I suggest reviewing the authentication logic in "authController.js". Consider adding rate limiting middleware to prevent brute-force attacks.\n\nAlso, here's a quick snippet:\n\`\`\`javascript\nconst limit = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });\napp.use(limit);\n\`\`\``;
  }

  if (effectiveProvider === "openai") {
    if (!apiKey) {
      throw new ApiError(500, "AI_API_KEY is not set");
    }
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      // throw new ApiError(502, `AI provider error: ${text}`);
      return `Error calling OpenAI: ${text}`;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  }

  if (effectiveProvider === "gemini") {
    if (!apiKey) {
        throw new ApiError(500, "AI_API_KEY is not set for Gemini");
    }
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
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
      // throw new ApiError(502, `AI provider error: ${text}`);
       return `Error calling Gemini: ${text}`;
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }

  if (effectiveProvider === "local") {
    const baseUrl = process.env.AI_LOCAL_URL || "http://localhost:11434";
    // Default model to llama3 as it's the current standard for local dev
    const localModel = process.env.AI_LOCAL_MODEL || "llama3";
    
    try {
        // Try chat endpoint first as it's more robust for newer models
        const response = await fetch(`${baseUrl}/api/chat`, {
             method: "POST",
             headers: { "Content-Type": "application/json" },
             body: JSON.stringify({
                 model: localModel,
                 messages: [{ role: "user", content: prompt }],
                 stream: false,
             }),
        });

        if (response.ok) {
            const data = await response.json();
            return data.message?.content || "";
        }

        // Fallback to generate endpoint if chat fails (older models)
        const genResponse = await fetch(`${baseUrl}/api/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: localModel,
                prompt,
                stream: false,
            }),
        });
        
        if (!genResponse.ok) {
             return "Local AI service returned an error.";
        }

        const data = await genResponse.json();
        return data.response || "";

    } catch (e) {
        return `Failed to connect to Local AI (Ollama) at ${baseUrl}. Ensure it is running.`;
    }
  }

  throw new ApiError(400, "Unsupported AI provider");
};

module.exports = {
  callAi,
};
