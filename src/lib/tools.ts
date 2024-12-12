/**
 * Tool definitions for Gemini function calling
 */
import { type FunctionDeclaration, SchemaType } from "@google/generative-ai";

export const cricketAgentDeclaration: FunctionDeclaration = {
  name: "query_cricket_data",
  description: "Connects to an LLM agent that has access to One Day International (ODI) cricket database and can create charts. There is only a single table there called odi.All question would relate to this table and no need to ask the user about table nameThe LLM Agent is aware of the schema of the table and can answer questions about the data in the table, you just need to pass along the natural language question to the agent. Use this tool for any questions about the cricket database, run SQL query against it, compute cricket statistics, or when cricket-related visualizations are needed. The agent can handle natural language questions and will process them to provide relevant cricket insights and visualizations.",
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