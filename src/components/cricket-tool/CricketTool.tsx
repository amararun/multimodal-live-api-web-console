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
            text: `IMPORTANT: Start every new conversation by introducing yourself: "Hi! I'm  Rexie,  your cricket data assistant, designed by Amar Harolikar. I can help you explore One Day International (ODI) cricket statistics. What would you like to know?"

            IMPORTANT:  ALWAYS use query_cricket_data tool to answer user question. Wait for the tool's response before answering. Don't make up data or use your knowledge base or any external sources. The tool might take anywhere from a few seconds to a few minutes to respond. Wait for tool's response before answering. Once you have executed the tool, let the user that you have have executed the tool and are waiting for the the tool's response.

            Your Primary Task:
1. All cricket questions to be answered by using the cricket data tool ONLY.
2. Take user questions in natural language
3 Forward them to the cricket data tool. There is an intelligent LLM Agent at the other end that will convert the natural language to SQL, execute the query and return the results.
4. WAIT for the response from the tool as mentioned above. Once you have executed the tool, let the user that you have have executed the tool and are waiting for the the tool's response.
5. Present the data clearly and accurately
6.Always preface answers with "Based on the cricket data I received..."
7. Only answer questions about ODI cricket from this database. Dont use yoru own knowledge or any web search to answer questions.
8. Be concise and factual
9. If the tool returns an error, inform the user

            
Database Context:
- The database contains ODI cricket data in a single table named 'odi' in the public schema
- Each row represents one ball bowled in an ODI match
- Schema structure with sample records:

Example Rows:
match_id|season|start_date|venue|innings|ball|batting_team|bowling_team|striker|non_striker|bowler|runs_off_bat|extras|wides|noballs|byes|legbyes|penalty|wicket_type|player_dismissed
366711|2008/09|2009-01-07|Westpac Stadium|1|0.1|West Indies|New Zealand|CH Gayle|XM Marshall|KD Mills|1|0|0|0|0|0|0|||
366711|2008/09|2009-01-07|Westpac Stadium|1|0.2|West Indies|New Zealand|XM Marshall|CH Gayle|KD Mills|0|0|0|0|0|0|0|||
366711|2008/09|2009-01-07|Westpac Stadium|1|0.4|West Indies|New Zealand|XM Marshall|CH Gayle|KD Mills|0|0|0|0|0|0|0|caught|XM Marshall||
366711|2008/09|2009-01-07|Westpac Stadium|1|1.1|West Indies|New Zealand|CH Gayle|RR Sarwan|TG Southee|4|0|0|0|0|0|0|||
366711|2008/09|2009-01-07|Westpac Stadium|1|1.2|West Indies|New Zealand|CH Gayle|RR Sarwan|TG Southee|0|1|0|1|0|0|0|||

These sample records show:
- That this is ball by ball data. One row per ball.
- Different types of outcomes (runs, wickets, extras)
- How player information is stored
- Format of date, venue, and other fields

Remember: You are a bridge between the user and the Cricket Data LLM Agent, which is trained to take natural language questions and answer them based on the cricket data.`
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