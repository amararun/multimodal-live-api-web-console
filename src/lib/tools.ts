/**
 * Tool definitions for Gemini function calling
 */
import { type FunctionDeclaration, SchemaType } from "@google/generative-ai";

export const cricketAgentDeclaration: FunctionDeclaration = {
  name: "query_cricket_data",
  description: "Connects to an LLM agent that has access to One Day International (ODI) cricket database and can create charts. There is only a single table called odi. All questions would relate to this table and no need to ask the user about table name. The LLM Agent is aware of the schema of the table and can answer questions about the data in the table. IMPORTANT: When you receive a response from this tool, you must use the data returned in the response to answer the user's question. The response will contain factual cricket data that you should incorporate into your answer. Do not make up or guess information - only use what the tool returns.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      question: {
        type: SchemaType.STRING,
        description: "The complete natural language question about cricket data that will be sent to the agent"
      }
    },
    required: ["question"]
  }
}; 