const obsidian = require("obsidian");
const { VALID_VERDICTS, VALID_RATINGS } = require("./constants");

/**
 * Handles all communication with the AI evaluation API.
 */
class AIService {
    constructor(settings) {
        this.settings = settings;
    }

    /**
     * Main entry: sends question + expected + user answer to AI,
     * then parses and validates the structured JSON response.
     */
    async evaluate(question, expectedAnswer, userAnswer) {
        const messages = this.buildMessages(question, expectedAnswer, userAnswer);
        const response = await this.makeRequest(messages);

        if (response.status < 200 || response.status >= 300) {
            throw new Error(this.extractError(response));
        }

        const data = response.json;
        if (!data || !data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error("Invalid API response structure");
        }

        const content = data.choices[0].message.content;
        const parsed = this.parseJSON(content);
        this.validateEvaluation(parsed);
        return parsed;
    }

    /**
     * Builds the system + user messages for the chat completion.
     */
    buildMessages(question, expectedAnswer, userAnswer) {
        return [
            {
                role: "system",
                content: `You are an expert technical interviewer evaluating a candidate's answer to a technical flashcard question.

Evaluate the answer based on:
- Technical correctness
- Conceptual understanding
- Missing important concepts
- Incorrect technical statements
- Whether the answer is sufficient for an interview

Rules:
- Accept technically correct alternative explanations, terminology, and wording.
- Do NOT use exact text matching.
- Do NOT invent missing information or claim the user said something they did not say.

Respond ONLY with a valid JSON object matching this exact schema. Do not include markdown code blocks or extra text:
{
  "score": number (0-100),
  "verdict": string ("correct", "partially_correct", or "incorrect"),
  "technical_accuracy": string,
  "strengths": array of strings,
  "missing_concepts": array of strings,
  "mistakes": array of strings,
  "improved_answer": string,
  "interview_feedback": string,
  "suggested_rating": string ("Again", "Hard", "Good", or "Easy")
}`
            },
            {
                role: "user",
                content: `Question: ${question}\n\nExpected Answer: ${expectedAnswer}\n\nUser's Answer: ${userAnswer}\n\nEvaluate the user's answer fairly, accepting alternative correct explanations.`
            }
        ];
    }

    /**
     * Performs the actual HTTP POST via Obsidian's requestUrl.
     */
    async makeRequest(messages) {
        const url = `${this.settings.baseURL}/chat/completions`;
        const body = {
            model: this.settings.model,
            messages: messages,
            temperature: 0.3
        };

        const headers = {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${this.settings.apiKey}`
        };

        try {
            return await obsidian.requestUrl({
                url,
                method: "POST",
                headers,
                body: JSON.stringify(body)
            });
        } catch (networkError) {
            throw new Error(`Network error: ${networkError.message || networkError}`);
        }
    }

    /**
     * Extracts a readable error string from an API response.
     */
    extractError(response) {
        let msg = `HTTP ${response.status}`;
        if (response.json && response.json.error) {
            const err = response.json.error;
            msg += `: ${err.message || JSON.stringify(err)}`;
        } else if (response.text) {
            msg += `: ${response.text.substring(0, 200)}`;
        }
        if (response.status === 401) msg += " (check your API key)";
        if (response.status === 429) msg += " (rate limit exceeded)";
        return msg;
    }

    /**
     * Parses the raw AI response, stripping markdown fences if present.
     */
    parseJSON(content) {
        if (!content) throw new Error("Empty AI response content");

        let cleaned = content.trim();

        if (cleaned.startsWith("```")) {
            cleaned = cleaned
                .replace(/^```(?:json)?\s*/, "")
                .replace(/\s*```$/, "")
                .trim();
        }

        try {
            return JSON.parse(cleaned);
        } catch (e) {
            throw new Error(`Failed to parse AI response as JSON: ${e.message}`);
        }
    }

    /**
     * Validates the parsed evaluation object against the required schema.
     */
    validateEvaluation(evaluation) {
        if (!evaluation || typeof evaluation !== "object") {
            throw new Error("Evaluation is not a valid object");
        }

        const required = [
            "score", "verdict", "technical_accuracy", "strengths",
            "missing_concepts", "mistakes", "improved_answer",
            "interview_feedback", "suggested_rating"
        ];

        for (const field of required) {
            if (!(field in evaluation)) {
                throw new Error(`Missing required field: ${field}`);
            }
        }

        if (typeof evaluation.score !== "number" || evaluation.score < 0 || evaluation.score > 100) {
            throw new Error(`Invalid score: ${evaluation.score} (must be 0-100)`);
        }

        if (!VALID_VERDICTS.includes(evaluation.verdict)) {
            throw new Error(`Invalid verdict: ${evaluation.verdict}`);
        }

        if (!VALID_RATINGS.includes(evaluation.suggested_rating)) {
            throw new Error(`Invalid suggested_rating: ${evaluation.suggested_rating}`);
        }

        for (const arrField of ["strengths", "missing_concepts", "mistakes"]) {
            if (!Array.isArray(evaluation[arrField])) {
                throw new Error(`Field ${arrField} must be an array`);
            }
        }

        for (const strField of ["technical_accuracy", "improved_answer", "interview_feedback"]) {
            if (typeof evaluation[strField] !== "string") {
                throw new Error(`Field ${strField} must be a string`);
            }
        }
    }
}

module.exports = { AIService };
