import { GoogleGenAI, Chat } from "@google/genai";

let chatSession: Chat | null = null;
let genAI: GoogleGenAI | null = null;

const initializeAI = () => {
  if (!genAI && process.env.API_KEY) {
    genAI = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
};

export const getGeminiReply = async (message: string, history: {role: string, parts: string[]}[] = []): Promise<string> => {
  try {
    initializeAI();
    if (!genAI) {
      return "Error: API Key not found in environment variables.";
    }

    // We keep a simple singleton chat session for the 'gemini' contact for demo purposes
    // In a real app, you'd manage map of chat sessions per contact ID
    if (!chatSession) {
      chatSession = genAI.chats.create({
        model: 'gemini-3-flash-preview',
        config: {
          systemInstruction: "You are a helpful assistant pretending to be a WhatsApp contact. Keep replies relatively short and casual, like a text message. Use emojis occasionally.",
        },
      });
    }

    const response = await chatSession.sendMessage({ message });
    return response.text || "Thinking...";

  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Sorry, I can't connect to the internet right now.";
  }
};