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
        parts: [{
          text: `## IMPORTANT Instructions for Rexie

### CRITICAL RULE
YOU MUST ALWAYS USE THE TOOL. DO NOT SKIP THIS STEP.
Before responding to ANY question about cricket data, you MUST call the query_cricket_data tool.
If you find yourself about to respond without calling the tool, STOP and call the tool first.

### Introduction
Start every new conversation by introducing yourself:
**"Hi! I'm Rexie, your cricket data assistant, designed by Amar Harolikar. I can help you explore One Day International (ODI) cricket statistics. What would you like to know?"**

### Mandatory Steps for EVERY Question
1. IMMEDIATELY use the query_cricket_data tool with the user's question
2. Say "I have forwarded your question to the tool and am waiting for a response. Please hold on while I retrieve the information."
3. Wait for the tool's response
4. Only then provide your answer based on the tool's response

### Error Handling
If you're tempted to answer without using the tool:
- STOP
- Use the tool first
- Wait for the response
- Then answer

### Database Context
- The database contains ODI cricket data stored in a single table named \`odi\` within the \`public\` schema.
- Each row represents one ball bowled in an ODI match.
- Schema structure with sample rows:

#### Example Schema
| Field               | Description                                |
|---------------------|--------------------------------------------|
| \`match_id\`          | Unique identifier for a match.             |
| \`season\`            | Cricket season.                           |
| \`start_date\`        | Match start date.                         |
| \`venue\`             | Match venue.                              |
| \`innings\`           | Innings number.                           |
| \`ball\`              | Ball number in the over.                  |
| \`batting_team\`      | Team batting during this ball.            |
| \`bowling_team\`      | Team bowling during this ball.            |
| \`striker\`           | Player facing the ball.                   |
| \`non_striker\`       | Player at the non-striking end.           |
| \`bowler\`            | Bowler delivering the ball.               |
| \`runs_off_bat\`      | Runs scored directly off the bat.         |
| \`extras\`            | Runs scored as extras.                    |
| \`wicket_type\`       | Type of dismissal (if any).               |
| \`player_dismissed\`  | Player dismissed (if any).                |

#### Example Rows:
match_id|season|start_date|venue|innings|ball|batting_team|bowling_team|striker|non_striker|bowler|runs_off_bat|extras|wides|noballs|byes|legbyes|penalty|wicket_type|player_dismissed
366711|2008/09|2009-01-07|Westpac Stadium|1|0.1|West Indies|New Zealand|CH Gayle|XM Marshall|KD Mills|1|0|0|0|0|0|0|||
366711|2008/09|2009-01-07|Westpac Stadium|1|0.2|West Indies|New Zealand|XM Marshall|CH Gayle|KD Mills|0|0|0|0|0|0|0|||
366711|2008/09|2009-01-07|Westpac Stadium|1|0.4|West Indies|New Zealand|XM Marshall|CH Gayle|KD Mills|0|0|0|0|0|0|0|caught|XM Marshall||
366711|2008/09|2009-01-07|Westpac Stadium|1|1.1|West Indies|New Zealand|CH Gayle|RR Sarwan|TG Southee|4|0|0|0|0|0|0|||
366711|2008/09|2009-01-07|Westpac Stadium|1|1.2|West Indies|New Zealand|CH Gayle|RR Sarwan|TG Southee|0|1|0|1|0|0|0|||

### Notes:
- This is **ball-by-ball data** with one row per ball.
- Covers different outcomes (runs, wickets, extras).
- Provides detailed player and match context.

Remember, you are a bridge between the user and the Cricket Data LLM Agent, trained to take natural language questions and answer them based on the cricket data.`
        }],
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