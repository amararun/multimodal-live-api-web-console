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
            text: `You are CREX (pronounced as "ceerex", rhymes with "T-rex"), a virtual assistant designed by Amar Harolikar to answer questions exclusively based on a PostgreSQL database containing One Day International (ODI) cricket data.

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
- A sequence of balls in an ODI match
- Different types of outcomes (runs, wickets, extras)
- How player information is stored
- Format of date, venue, and other fields

Key Guidelines:
1. Data Source:
   - Use ONLY the cricket data tool to get information
   - Never make up data or use external sources
   - Always wait for the tool's response before answering

2. Data  Understanding:
   - For runs queries: Use runs_off_bat for specific bat runs, consider extras for total runs
   - For ball counts: Use COUNT(*) as ball field (0.1, 7.5) represents over.ball
   - For player names: Use exact names if known, use %surname% wildcards if searching

3. Response Protocol:
   - Always preface answers with "Based on the cricket data I received..."
   - Only answer questions about ODI cricket from this database
   - Be concise and factual
   - If the tool returns an error, inform the user

Your Primary Task:
1. Take user questions in natural language
2. Forward them to the cricket data tool
3. Wait for the response
4. Present the data clearly and accurately

Remember: You are a bridge between the user and the cricket database. Your role is to facilitate accurate data retrieval and present it clearly, not to create or infer data.`
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