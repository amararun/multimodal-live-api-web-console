import { useEffect, useRef, memo } from "react";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";
import { ToolCall } from "../../multimodal-live-types";
import { cricketAgentDeclaration } from "../../lib/tools";

function generateSessionId(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function CricketToolComponent() {
  const { client, setConfig } = useLiveAPIContext();
  // Generate session ID once when component mounts
  const sessionId = useRef(generateSessionId());

  // Register the tool with Gemini
  useEffect(() => {
    setConfig({
      model: "models/gemini-2.0-flash-exp",
      // Set all temperature and related parameters to 0.1 for maximum determinism
      generationConfig: {
        temperature: 0.1,
        topP: 0.1,
        topK: 1
      },
      tools: [
        { functionDeclarations: [cricketAgentDeclaration] }
      ],
    });
  }, [setConfig]);

  // Handle tool calls
  useEffect(() => {
    const onToolCall = async (toolCall: ToolCall) => {
      console.log(`got cricket toolcall`, toolCall);
      const fc = toolCall.functionCalls.find(
        (fc) => fc.name === cricketAgentDeclaration.name
      );

      if (fc) {
        try {
          const { question } = fc.args as { question: string };
          const chatflowId = '5e61fc5e-a2d9-410d-b1a4-1519fa0c3b4d';
          const baseUrl = 'https://flowise-coolify.hosting.tigzig.com';
          
          const response = await fetch(`${baseUrl}/api/v1/prediction/${chatflowId}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
              question: question,
              overrideConfig: {
                sessionId: sessionId.current,
                // Set all temperature and sampling parameters to minimum for most deterministic responses
                temperature: 0.1,
                modelSettings: {
                  temperature: 0.1,
                  top_p: 0.1,
                  frequency_penalty: 0.0,
                  presence_penalty: 0.0
                }
              }
            })
          });

          if (!response.ok) {
            throw new Error('Cricket API call failed');
          }

          const data = await response.json();
          console.log('Cricket API Response:', data);
          
          // Send the response back to Gemini
          client.sendToolResponse({
            functionResponses: [{
              response: { 
                output: data.text || data.message,
                data: data  // Including full response data in case it contains additional information
              },
              id: fc.id
            }]
          });
        } catch (error) {
          console.error('Cricket API call failed:', error);
          // Send error response back to Gemini
          client.sendToolResponse({
            functionResponses: [{
              response: { error: 'Failed to fetch cricket data' },
              id: fc.id
            }]
          });
        }
      }
    };

    client.on("toolcall", onToolCall);
    return () => {
      client.off("toolcall", onToolCall);
    };
  }, [client]);

  // This component doesn't render anything visible
  return null;
}

export const CricketTool = memo(CricketToolComponent); 