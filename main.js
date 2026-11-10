const obsidian = require("obsidian");

// ─── Constants ───

const DEFAULT_SETTINGS = {
    apiKey: "",
    baseURL: "https://backend.sovereigneg.com/v1",
    model: "kimi-k3"
};

const VALID_VERDICTS = ["correct", "partially_correct", "incorrect"];
const VALID_RATINGS = ["Again", "Hard", "Good", "Easy"];

// ─── Plugin ───

module.exports = class AISpacedRepetition extends obsidian.Plugin {

    async onload() {
        console.log("AI Spaced Repetition: Plugin loaded");

        await this.loadSettings();

        // Register command in Obsidian Command Palette
        this.addCommand({
            id: "open-ai-review",
            name: "Open AI Review",
            callback: () => {
                new FlashcardReviewModal(this.app, this.settings).open();
            }
        });

        // Settings tab
        this.addSettingTab(new AISpacedRepetitionSettingTab(this.app, this));

        // Display notification when plugin loads
        new obsidian.Notice("AI Spaced Repetition loaded!");
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    onunload() {
        console.log("AI Spaced Repetition: Plugin unloaded");
    }
};

// ─── Settings Tab ───

class AISpacedRepetitionSettingTab extends obsidian.PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl("h2", { text: "AI Spaced Repetition Settings" });

        new obsidian.Setting(containerEl)
            .setName("API Key")
            .setDesc("Your SovereignEG API key. Never share this key.")
            .addText(text => {
                text.inputEl.type = "password";
                text.setPlaceholder("sk-...")
                    .setValue(this.plugin.settings.apiKey)
                    .onChange(async (value) => {
                        this.plugin.settings.apiKey = value.trim();
                        await this.plugin.saveSettings();
                    });
            });

        new obsidian.Setting(containerEl)
            .setName("Base URL")
            .setDesc("The base URL for the OpenAI-compatible API")
            .addText(text => text
                .setPlaceholder("https://backend.sovereigneg.com/v1")
                .setValue(this.plugin.settings.baseURL)
                .onChange(async (value) => {
                    this.plugin.settings.baseURL = value.trim().replace(/\/+$/, "");
                    await this.plugin.saveSettings();
                }));

        new obsidian.Setting(containerEl)
            .setName("Model")
            .setDesc("The model name to use for evaluations")
            .addText(text => text
                .setPlaceholder("kimi-k3")
                .setValue(this.plugin.settings.model)
                .onChange(async (value) => {
                    this.plugin.settings.model = value.trim();
                    await this.plugin.saveSettings();
                }));
    }
}

// ─── Flashcard Review Modal ───

class FlashcardReviewModal extends obsidian.Modal {

    constructor(app, settings) {
        super(app);
        this.settings = settings;

        // Hardcoded test flashcard
        this.question = "What is the difference between Kubernetes Deployment and StatefulSet?";
        this.expectedAnswer = "A Deployment manages stateless applications using ReplicaSets, while a StatefulSet manages stateful applications and provides stable network identities and persistent storage associations.";
        
        // State management
        this.isAnswerRevealed = false;
        this.userAnswer = "";
        this.validationMessage = null;
        this.isEvaluating = false;
        this.evaluationResult = null;

        // DOM elements
        this.expectedAnswerContainer = null;
        this.userAnswerTextarea = null;
        this.revealButton = null;
        this.evaluateButton = null;
        this.validationElement = null;
        this.evaluationResultsContainer = null;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.classList.add("ai-spaced-repetition-modal");
        
        this.renderQuestionSection(contentEl);
        this.renderUserAnswerSection(contentEl);
        this.renderExpectedAnswerSection(contentEl);
        this.renderEvaluationResultsSection(contentEl);
        this.renderActionButtons(contentEl);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }

    // ── Rendering ──

    renderQuestionSection(container) {
        const questionHeader = container.createEl("div", {
            cls: "flashcard-question-section"
        });
        
        questionHeader.createEl("h2", {
            text: "Question",
            cls: "flashcard-section-title"
        });
        
        questionHeader.createEl("p", {
            text: this.question,
            cls: "flashcard-question-text"
        });
    }

    renderUserAnswerSection(container) {
        const answerSection = container.createEl("div", {
            cls: "flashcard-user-answer-section"
        });
        
        answerSection.createEl("h3", {
            text: "Your Answer",
            cls: "flashcard-section-subtitle"
        });

        this.userAnswerTextarea = answerSection.createEl("textarea", {
            cls: "flashcard-textarea"
        });
        this.userAnswerTextarea.setAttribute("rows", "6");
        this.userAnswerTextarea.setAttribute("placeholder", "Type your answer here...");
        this.userAnswerTextarea.value = this.userAnswer;

        this.userAnswerTextarea.addEventListener("input", (event) => {
            this.userAnswer = event.target.value;
            this.clearValidationMessage();
        });

        this.validationElement = answerSection.createEl("div", {
            cls: "flashcard-validation-message"
        });
        this.validationElement.style.display = "none";
    }

    renderExpectedAnswerSection(container) {
        const expectedSection = container.createEl("div", {
            cls: "flashcard-expected-answer-section"
        });

        this.expectedAnswerContainer = expectedSection.createEl("div", {
            cls: "flashcard-expected-answer-content"
        });
        this.expectedAnswerContainer.style.display = "none";

        this.expectedAnswerContainer.createEl("h3", {
            text: "Expected Answer",
            cls: "flashcard-section-subtitle"
        });

        this.expectedAnswerContainer.createEl("div", {
            text: this.expectedAnswer,
            cls: "flashcard-expected-answer-text"
        });
    }

    renderEvaluationResultsSection(container) {
        this.evaluationResultsContainer = container.createEl("div", {
            cls: "evaluation-results-container"
        });
        this.evaluationResultsContainer.style.display = "none";
    }

    renderActionButtons(container) {
        const buttonSection = container.createEl("div", {
            cls: "flashcard-button-section"
        });

        this.revealButton = buttonSection.createEl("button", {
            text: "Reveal Expected Answer",
            cls: "mod-cta flashcard-reveal-button"
        });
        this.revealButton.addEventListener("click", () => {
            this.toggleExpectedAnswer();
        });

        this.evaluateButton = buttonSection.createEl("button", {
            text: "Evaluate Answer",
            cls: "mod-cta flashcard-evaluate-button"
        });
        this.evaluateButton.addEventListener("click", () => {
            this.evaluateAnswer();
        });

        // Copy Session button
        const copyButton = buttonSection.createEl("button", {
            text: "Copy Session",
            cls: "flashcard-copy-button"
        });
        copyButton.addEventListener("click", () => {
            this.copySessionToClipboard();
        });

        const closeButton = buttonSection.createEl("button", {
            text: "Close",
            cls: "flashcard-close-button"
        });
        closeButton.addEventListener("click", () => {
            this.close();
        });
    }

    // ── Actions ──

    toggleExpectedAnswer() {
        this.isAnswerRevealed = !this.isAnswerRevealed;
        
        if (this.isAnswerRevealed) {
            this.expectedAnswerContainer.style.display = "block";
            this.revealButton.textContent = "Hide Expected Answer";
        } else {
            this.expectedAnswerContainer.style.display = "none";
            this.revealButton.textContent = "Reveal Expected Answer";
        }
    }

    showValidationMessage(message) {
        if (this.validationElement) {
            this.validationElement.textContent = message;
            this.validationElement.style.display = "block";
        }
    }

    clearValidationMessage() {
        if (this.validationElement) {
            this.validationElement.textContent = "";
            this.validationElement.style.display = "none";
        }
    }

    setEvaluateButtonState(state) {
        if (!this.evaluateButton) return;

        if (state === "loading") {
            this.evaluateButton.textContent = "Evaluating...";
            this.evaluateButton.disabled = true;
            this.evaluateButton.classList.add("is-loading");
        } else if (state === "reevaluate") {
            this.evaluateButton.textContent = "Re-evaluate Answer";
            this.evaluateButton.disabled = false;
            this.evaluateButton.classList.remove("is-loading");
        } else {
            // default / idle
            this.evaluateButton.textContent = "Evaluate Answer";
            this.evaluateButton.disabled = false;
            this.evaluateButton.classList.remove("is-loading");
        }
    }

    // ── Evaluation ──

    async evaluateAnswer() {
        this.userAnswer = this.userAnswerTextarea.value.trim();

        if (!this.userAnswer) {
            this.showValidationMessage("Please provide an answer before evaluating.");
            this.userAnswerTextarea.focus();
            return;
        }

        if (!this.settings.apiKey) {
            new obsidian.Notice("API key not configured. Go to Settings → AI Spaced Repetition to add your key.");
            return;
        }

        if (this.isEvaluating) {
            return; // Prevent duplicate requests
        }

        this.isEvaluating = true;
        this.clearValidationMessage();
        this.setEvaluateButtonState("loading");

        try {
            const result = await this.callAIEvaluation();
            this.evaluationResult = result;
            this.renderEvaluationResult(result);
            this.setEvaluateButtonState("reevaluate");
        } catch (error) {
            console.error("AI Evaluation error:", error);
            this.showValidationMessage(`Evaluation failed: ${error.message}`);
            this.setEvaluateButtonState(this.evaluationResult ? "reevaluate" : "idle");
        } finally {
            this.isEvaluating = false;
        }
    }

    async callAIEvaluation() {
        const messages = [
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
                content: `Question: ${this.question}\n\nExpected Answer: ${this.expectedAnswer}\n\nUser's Answer: ${this.userAnswer}\n\nEvaluate the user's answer fairly, accepting alternative correct explanations.`
            }
        ];

        const response = await this.makeAPIRequest(messages);

        if (response.status < 200 || response.status >= 300) {
            throw new Error(this.extractAPIError(response));
        }

        const data = response.json;
        if (!data || !data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error("Invalid API response structure");
        }

        const content = data.choices[0].message.content;
        const parsed = this.parseAIJSON(content);
        this.validateEvaluation(parsed);
        return parsed;
    }

    async makeAPIRequest(messages) {
        const url = `${this.settings.baseURL}/chat/completions`;
        const body = {
            model: this.settings.model,
            messages: messages,
            temperature: 0.3
        };

        // Do not log the API key
        const headers = {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${this.settings.apiKey}`
        };

        try {
            return await obsidian.requestUrl({
                url: url,
                method: "POST",
                headers: headers,
                body: JSON.stringify(body)
            });
        } catch (networkError) {
            throw new Error(`Network error: ${networkError.message || networkError}`);
        }
    }

    extractAPIError(response) {
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

    parseAIJSON(content) {
        if (!content) throw new Error("Empty AI response content");

        let cleaned = content.trim();

        // Strip markdown code fences
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

    // ── Result Rendering ──

    renderEvaluationResult(result) {
        if (!this.evaluationResultsContainer) return;

        const c = this.evaluationResultsContainer;
        c.empty();
        c.style.display = "block";

        // Score & Verdict
        const scoreSec = c.createEl("div", { cls: "evaluation-score-section" });
        scoreSec.createEl("div", {
            text: `${result.score}`,
            cls: `evaluation-score ${this.getScoreClass(result.score)}`
        });
        scoreSec.createEl("div", {
            text: this.capitalizeFirst(result.verdict.replace(/_/g, " ")),
            cls: `evaluation-verdict verdict-${result.verdict}`
        });

        // Technical Accuracy
        this.createResultSection(c, "Technical Accuracy", result.technical_accuracy, "evaluation-technical-accuracy");

        // Strengths
        if (result.strengths && result.strengths.length > 0) {
            this.createListSection(c, "Strengths", result.strengths, "evaluation-strengths");
        }

        // Missing Concepts
        if (result.missing_concepts && result.missing_concepts.length > 0) {
            this.createListSection(c, "Missing Concepts", result.missing_concepts, "evaluation-missing");
        }

        // Mistakes
        if (result.mistakes && result.mistakes.length > 0) {
            this.createListSection(c, "Mistakes", result.mistakes, "evaluation-mistakes");
        }

        // Improved Answer
        if (result.improved_answer) {
            this.createResultSection(c, "Improved Answer", result.improved_answer, "evaluation-improved");
        }

        // Interview Feedback
        if (result.interview_feedback) {
            this.createResultSection(c, "Interview Feedback", result.interview_feedback, "evaluation-feedback");
        }

        // SR Rating
        const ratingSec = c.createEl("div", { cls: "evaluation-rating-section" });
        ratingSec.createEl("h4", { text: "Suggested Rating", cls: "evaluation-rating-title" });
        ratingSec.createEl("span", {
            text: result.suggested_rating,
            cls: `evaluation-rating rating-${result.suggested_rating.toLowerCase()}`
        });
    }

    createResultSection(container, title, content, cls) {
        const sec = container.createEl("div", { cls: `evaluation-section ${cls}` });
        sec.createEl("h4", { text: title, cls: "evaluation-section-title" });
        sec.createEl("div", { text: content, cls: "evaluation-section-content" });
        return sec;
    }

    createListSection(container, title, items, cls) {
        const sec = container.createEl("div", { cls: `evaluation-section ${cls}` });
        sec.createEl("h4", { text: title, cls: "evaluation-section-title" });
        const list = sec.createEl("ul", { cls: "evaluation-list" });
        for (const item of items) {
            list.createEl("li", { text: item, cls: "evaluation-list-item" });
        }
        return sec;
    }

    getScoreClass(score) {
        if (score >= 80) return "score-excellent";
        if (score >= 60) return "score-good";
        if (score >= 40) return "score-fair";
        return "score-poor";
    }

    capitalizeFirst(str) {
        if (!str) return "";
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    copySessionToClipboard() {
        const currentUserAnswer = this.userAnswerTextarea ? this.userAnswerTextarea.value.trim() : this.userAnswer;

        let text = `# Flashcard Session

## Question
${this.question}

## Your Answer
${currentUserAnswer || "(no answer submitted)"}

## Expected Answer
${this.expectedAnswer}
`;

        if (this.evaluationResult) {
            const r = this.evaluationResult;
            text += `
## AI Evaluation

**Score:** ${r.score}/100  
**Verdict:** ${r.verdict.replace(/_/g, " ")}  
**Suggested Rating:** ${r.suggested_rating}

### Technical Accuracy
${r.technical_accuracy}

### Strengths
${r.strengths.length > 0 ? r.strengths.map(s => `- ${s}`).join("\n") : "_None listed_"}

### Missing Concepts
${r.missing_concepts.length > 0 ? r.missing_concepts.map(m => `- ${m}`).join("\n") : "_None listed_"}

### Mistakes
${r.mistakes.length > 0 ? r.mistakes.map(m => `- ${m}`).join("\n") : "_None listed_"}

### Improved Answer
${r.improved_answer}

### Interview Feedback
${r.interview_feedback}
`;
        } else {
            text += `
## AI Evaluation
_Not evaluated yet._
`;
        }

        navigator.clipboard.writeText(text).then(() => {
            new obsidian.Notice("Session copied to clipboard!");
        }).catch((err) => {
            console.error("Failed to copy:", err);
            new obsidian.Notice("Failed to copy session. Check browser permissions.");
        });
    }
}

