import dotenv from 'dotenv';
dotenv.config();
import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

export const LLM_CONFIG = {
    models: {
      openai_gpt_4o_mini: {
        model: "gpt-4o-mini",
        temperature: 0,
        streaming: true,
        // cache: true
      },
      openai_gpt_4o: {
        model: "gpt-4o",
        temperature: 0,
        streaming: true,
        // cache: true
      },
      openai_gpt_3_5_turbo: {
        model: "gpt-3.5-turbo",
        temperature: 0,
        streaming: true,
        // cache: true
      },
      gemini_1_5_flash_8b: {
        name: "gemini-1.5-flash-8b",
        temperature: 0,
        maxOutputTokens: 2048
      },
      gemini_2_flash_exp: {
        name: "gemini-2.0-flash-exp",
        temperature: 0,
        maxOutputTokens: 2048
      }
    }
  };

// Initialize and export models
export const modelOpenAi = new ChatOpenAI(LLM_CONFIG.models.openai_gpt_4o_mini);
export const modelGoogle = new ChatGoogleGenerativeAI(LLM_CONFIG.models.gemini_1_5_flash_8b);