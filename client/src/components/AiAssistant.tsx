import { useState } from "react";

import { queryAi } from "../services/aiService";

type AiAssistantProps = {
  projectId?: string;
};

const AiAssistant = ({ projectId }: AiAssistantProps) => {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!prompt.trim()) {
      setError("Please enter a prompt.");
      return;
    }

    try {
      setLoading(true);
      const data = await queryAi({ prompt, projectId });
      setResponse(data.response);
    } catch (err: any) {
      setError(err?.response?.data?.message || "AI request failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="ai-assistant">
      <h3>AI Assistant</h3>
      <form onSubmit={handleSubmit}>
        <textarea
          className="input textarea"
          rows={6}
          placeholder="Paste code or ask a question..."
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
        />
        <button className="primary-button" type="submit" disabled={loading}>
          {loading ? "Thinking..." : "Ask AI"}
        </button>
      </form>

      {error ? <div className="form-alert error">{error}</div> : null}

      {response ? (
        <div className="ai-response">
          <h4>Response</h4>
          <pre>{response}</pre>
        </div>
      ) : null}
    </section>
  );
};

export default AiAssistant;
