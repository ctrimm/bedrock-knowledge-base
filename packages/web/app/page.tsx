'use client'

import { useQuery } from "@tanstack/react-query";
import React, { useEffect } from "react";

const promptKb = async (sessionId: string | undefined, text: string) => {
  const fetchResponse = await fetch(process.env.NEXT_PUBLIC_PROMPT_URL!, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: text,
      sessionId,
    }),
  });

  const fetchResponseJson = await fetchResponse.json();

  return fetchResponseJson as { sessionId: string; text: string };
};

export default function HomePage() {
  const [sessionId, setSessionId] = React.useState<string>();
  const [currentUserText, setCurrentUserText] = React.useState("");
  const [texts, setTexts] = React.useState([] as string[]);

  const prompt = useQuery({
    queryKey: ["prompt", texts],
    queryFn: () => {
      if (texts.length) {
        return promptKb(sessionId, texts[texts.length - 1]);
      }
      return null;
    },
    enabled: !!currentUserText || texts.length > 0,
    refetchOnMount: false,
    retryOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (prompt.data) {
      setSessionId(prompt.data.sessionId);
    }
  }, [prompt.data]);

  return (
    <div style={{ display: "flex", flexDirection: "column", padding: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h1>Bedrock Knowledge Base</h1>
        <a 
          href="/upload" 
          style={{ 
            padding: "8px 16px", 
            backgroundColor: "#0070f3", 
            color: "white", 
            textDecoration: "none", 
            borderRadius: "4px" 
          }}
        >
          Upload Documents
        </a>
      </div>
      <p>Current session: {sessionId}</p>

      <div style={{ marginBottom: "20px" }}>
        <input
          value={currentUserText}
          onChange={(event) => setCurrentUserText(event.target.value)}
          style={{ marginRight: "10px", padding: "8px", minWidth: "300px" }}
          placeholder="Ask a question..."
        />
        <button
          onClick={() => {
            setTexts([...texts, currentUserText]);
            setCurrentUserText("");
          }}
          disabled={prompt.isFetching}
          style={{ padding: "8px 16px" }}
        >
          Submit
        </button>
      </div>

      {texts[texts.length - 1] && (
        <div style={{ marginBottom: "10px" }}>
          <strong>Question:</strong> {texts[texts.length - 1]}
        </div>
      )}
      
      {prompt.data?.text && (
        <div style={{ marginBottom: "10px" }}>
          <strong>Answer:</strong> {prompt.data.text}
        </div>
      )}
      
      {prompt.isFetching && <p>Loading...</p>}
    </div>
  );
}