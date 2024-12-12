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
  const sessionId = useRef(generateSessionId());
  const pendingResponses = useRef(new Set<string>());

  // Register the tool with Gemini
  useEffect(() => {
    setConfig({
      model: "models/gemini-2.0-flash-exp",
      generationConfig: {
        temperature: 0.1,
        topP: 0.1,
        topK: 1,
        responseModalities: "audio",
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } },
        },
      },
      systemInstruction: {
        parts: [
          {
            text: `You are my helpful cricket data assistant. Follow these rules strictly:
1. When I ask ANY question about cricket or ODI data, ALWAYS use the query_cricket_data function first.
2. Wait for the function's response before answering.
3. Base your answer ONLY on the data returned by the function.
4. If the function returns an error, inform me about it.
5. Never make up cricket statistics - only use what the function provides.
6. After receiving data from the function, always acknowledge it by saying "Based on the cricket data I received..." before providing the answer.`
          }
        ]
      },
      tools: [
        { googleSearch: {} },
        { functionDeclarations: [cricketAgentDeclaration] }
      ],
    });
  }, [setConfig]);

  // Handle tool calls
  useEffect(() => {
    const onToolCall = (toolCall: ToolCall) => {
      console.log(`got cricket toolcall`, toolCall);
      
      if (toolCall.functionCalls.length) {
        Promise.all(
          toolCall.functionCalls.map(async (fc) => {
            // Skip if we've already handled this function call
            if (pendingResponses.current.has(fc.id)) {
              return null;
            }
            
            if (fc.name === cricketAgentDeclaration.name) {
              // Mark this function call as being processed
              pendingResponses.current.add(fc.id);
              
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
                      temperature: 0.1
                    }
                  })
                });

                if (!response.ok) {
                  throw new Error('Cricket API call failed');
                }

                const data = await response.json();
                console.log('Cricket API Response:', data);

                // Remove from pending after processing
                pendingResponses.current.delete(fc.id);

                return {
                  response: { 
                    output: data.text || data.message || JSON.stringify(data)
                  },
                  id: fc.id
                };
              } catch (error) {
                console.error('Cricket API call failed:', error);
                // Remove from pending after error
                pendingResponses.current.delete(fc.id);
                
                return {
                  response: { 
                    output: 'Failed to fetch cricket data'
                  },
                  id: fc.id
                };
              }
            }
            return null;
          })
        ).then(responses => {
          const validResponses = responses.filter(r => r !== null);
          if (validResponses.length > 0) {
            client.sendToolResponse({
              functionResponses: validResponses
            });
          }
        });
      }
    };

    client.on("toolcall", onToolCall);
    return () => {
      client.off("toolcall", onToolCall);
    };
  }, [client]);

  return null;
}

export const CricketTool = memo(CricketToolComponent); 