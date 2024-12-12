/**
 * Tool definitions for Gemini function calling
 */
import { type FunctionDeclaration, SchemaType } from "@google/generative-ai";

export const cricketAgentDeclaration: FunctionDeclaration = {
  name: "query_cricket_data",
  description: "Connects to an LLM agent that has access to ODI cricket database and can create charts. Use this tool for any questions about cricket statistics, ODI data, or when cricket-related visualizations are needed. The agent can handle natural language questions and will process them to provide relevant cricket insights and visualizations.",
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