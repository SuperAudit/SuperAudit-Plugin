import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

export interface LLMConfig {
  provider: "openai" | "anthropic" | "local";
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMAnalysisRequest {
  codeSnippet: string;
  ruleDescription: string;
  context: {
    fileName: string;
    functionName: string;
    contractName: string;
    severity: string;
  };
  analysisType: "vulnerability" | "fix" | "explanation" | "risk-ranking";
}

export interface LLMAnalysisResponse {
  explanation: string;
  suggestedFix?: string;
  riskScore?: number;
  additionalContext?: string;
  confidence: number;
}

export class LLMClient {
  private openai?: OpenAI;
  private anthropic?: Anthropic;
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
    
    if (config.provider === "openai" && config.apiKey) {
      this.openai = new OpenAI({ apiKey: config.apiKey });
    } else if (config.provider === "anthropic" && config.apiKey) {
      this.anthropic = new Anthropic({ apiKey: config.apiKey });
    }
  }

  async analyzeCode(request: LLMAnalysisRequest): Promise<LLMAnalysisResponse> {
    const prompt = this.buildPrompt(request);
    
    if (this.config.provider === "openai") {
      return await this.callOpenAI(prompt, request);
    } else if (this.config.provider === "anthropic") {
      return await this.callAnthropic(prompt, request);
    }
    
    throw new Error(`Unsupported LLM provider: ${this.config.provider}`);
  }

  private buildPrompt(request: LLMAnalysisRequest): string {
    return `You are an expert smart contract security auditor analyzing Solidity code.

CONTEXT:
- Contract: ${request.context.contractName}
- Function: ${request.context.functionName}
- File: ${request.context.fileName}
- Severity: ${request.context.severity}

RULE:
${request.ruleDescription}

CODE SNIPPET:
\`\`\`solidity
${request.codeSnippet}
\`\`\`

TASK: ${this.getTaskPrompt(request.analysisType)}

Provide your analysis in the following JSON format:
{
  "explanation": "Detailed explanation of the issue",
  "suggestedFix": "Concrete code fix with example",
  "riskScore": 1-10,
  "additionalContext": "Additional security considerations",
  "confidence": 0.0-1.0
}`;
  }

  private getTaskPrompt(type: string): string {
    switch (type) {
      case "vulnerability":
        return "Analyze this code for the security vulnerability described in the rule. Explain the attack vector and potential impact.";
      case "fix":
        return "Provide a secure code fix that addresses the vulnerability. Include before/after examples.";
      case "explanation":
        return "Explain this security issue in educational terms. Help the developer understand WHY this is dangerous.";
      case "risk-ranking":
        return "Assess the risk level of this vulnerability considering the context. Rank from 1 (low) to 10 (critical).";
      default:
        return "Analyze this code for security issues.";
    }
  }

  private async callOpenAI(prompt: string, request: LLMAnalysisRequest): Promise<LLMAnalysisResponse> {
    if (!this.openai) throw new Error("OpenAI not initialized");
    
    try {
      const model = this.config.model || "gpt-4o-mini";  // Default to gpt-4o-mini (supports json_object and is cheaper)
      const completionParams: any = {
        model,
        messages: [
          {
            role: "system",
            content: "You are an expert Solidity security auditor. Always respond with valid JSON."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: this.config.temperature || 0.3,
        max_tokens: this.config.maxTokens || 1000,
      };

      // Only add response_format for models that support it
      if (model.includes("gpt-4o") || model.includes("gpt-4-turbo") || model.includes("gpt-3.5-turbo-1106") || model.includes("gpt-3.5-turbo-0125")) {
        completionParams.response_format = { type: "json_object" };
      }

      const completion = await this.openai.chat.completions.create(completionParams);

      const responseText = completion.choices[0].message.content || "{}";
      
      // Try to parse as JSON, if it fails, extract JSON from the response
      let response;
      try {
        response = JSON.parse(responseText);
      } catch {
        // Try to extract JSON from markdown code blocks or other text
        const jsonMatch = responseText.match(/```json\n?([\s\S]*?)\n?```/) || responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          response = JSON.parse(jsonMatch[1] || jsonMatch[0]);
        } else {
          // Fallback: create a basic response from the text
          response = {
            explanation: responseText,
            confidence: 0.5
          };
        }
      }
      
      return this.validateResponse(response);
    } catch (error) {
      console.warn(`OpenAI API error: ${error}`);
      return this.getFallbackResponse();
    }
  }

  private async callAnthropic(prompt: string, request: LLMAnalysisRequest): Promise<LLMAnalysisResponse> {
    if (!this.anthropic) throw new Error("Anthropic not initialized");
    
    try {
      const message = await this.anthropic.messages.create({
        model: this.config.model || "claude-3-sonnet-20240229",
        max_tokens: this.config.maxTokens || 1000,
        temperature: this.config.temperature || 0.3,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      });

      const content = message.content[0];
      if (content.type === "text") {
        const response = JSON.parse(content.text);
        return this.validateResponse(response);
      }
      
      throw new Error("Invalid response from Anthropic");
    } catch (error) {
      console.warn(`Anthropic API error: ${error}`);
      return this.getFallbackResponse();
    }
  }

  private validateResponse(response: any): LLMAnalysisResponse {
    return {
      explanation: response.explanation || "No explanation provided",
      suggestedFix: response.suggestedFix,
      riskScore: response.riskScore,
      additionalContext: response.additionalContext,
      confidence: response.confidence || 0.5
    };
  }

  private getFallbackResponse(): LLMAnalysisResponse {
    return {
      explanation: "AI analysis unavailable. Please check your API key and network connection.",
      confidence: 0.0
    };
  }
}

