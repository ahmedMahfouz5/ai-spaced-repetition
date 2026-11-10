const obsidian = require("obsidian");
const { AIService } = require("./ai-service");
const { AudioRecorder } = require("./audio-recorder");
const { EvaluationRenderer } = require("./evaluation-renderer");
const { formatDuration, formatBytes, compileSessionReport } = require("./utilities");

/**
 * Modal: the complete flashcard review interface.
 * Coordinates rendering, text evaluation, voice recording, and session copying.
 */
class FlashcardReviewModal extends obsidian.Modal {
    constructor(app, settings) {
        super(app);
        this.settings = settings;
        this.aiService = new AIService(settings);
        this.audioRecorder = new AudioRecorder();
        this.evaluationRenderer = null;

        // Hardcoded test flashcard
        this.question = "What is the difference between Kubernetes Deployment and StatefulSet?";
        this.expectedAnswer = "A Deployment manages stateless applications using ReplicaSets, while a StatefulSet manages stateful applications and provides stable network identities and persistent storage associations.";

        // State
        this.isAnswerRevealed = false;
        this.userAnswer = "";
        this.isEvaluating = false;
        this.evaluationResult = null;

        // DOM refs
        this._dom = {};
    }

    // ═══════════════════════════════════════════════════════════
    // Lifecycle
    // ═══════════════════════════════════════════════════════════

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.classList.add("ai-spaced-repetition-modal");

        this.renderQuestionSection(contentEl);
        this.renderTextAnswerSection(contentEl);
        this.renderVoiceAnswerSection(contentEl);
        this.renderExpectedAnswerSection(contentEl);
        this.renderEvaluationSection(contentEl);
        this.renderActionButtons(contentEl);
    }

    onClose() {
        this.audioRecorder.cleanup();
        const { contentEl } = this;
        contentEl.empty();
    }

    // ═══════════════════════════════════════════════════════════
    // Rendering helpers
    // ═══════════════════════════════════════════════════════════

    renderQuestionSection(container) {
        const sec = container.createEl("div", { cls: "flashcard-question-section" });
        sec.createEl("h2", { text: "Question", cls: "flashcard-section-title" });
        sec.createEl("p", { text: this.question, cls: "flashcard-question-text" });
    }

    renderTextAnswerSection(container) {
        const sec = container.createEl("div", { cls: "flashcard-user-answer-section" });
        sec.createEl("h3", { text: "Your Answer", cls: "flashcard-section-subtitle" });

        this._dom.userAnswerTextarea = sec.createEl("textarea", { cls: "flashcard-textarea" });
        this._dom.userAnswerTextarea.setAttribute("rows", "6");
        this._dom.userAnswerTextarea.setAttribute("placeholder", "Type your answer here...");
        this._dom.userAnswerTextarea.value = this.userAnswer;

        this._dom.userAnswerTextarea.addEventListener("input", (event) => {
            this.userAnswer = event.target.value;
            this.showValidation("");
        });

        this._dom.validationEl = sec.createEl("div", { cls: "flashcard-validation-message" });
        this._dom.validationEl.style.display = "none";
    }

    renderVoiceAnswerSection(container) {
        const sec = container.createEl("div", { cls: "flashcard-voice-answer-section" });
        sec.createEl("h3", { text: "Voice Answer", cls: "flashcard-section-subtitle" });

        // Recording indicator
        this._dom.recordingIndicator = sec.createEl("div", { cls: "recording-indicator" });
        this._dom.recordingIndicator.style.display = "none";
        this._dom.recordingIndicator.createEl("span", { cls: "recording-dot" });
        this._dom.recordingIndicator.createEl("span", { text: " Recording", cls: "recording-label" });
        this._dom.recordingTimer = this._dom.recordingIndicator.createEl("span", { cls: "recording-timer" });

        // Recording controls (Start / Stop)
        const recControls = sec.createEl("div", { cls: "recording-controls" });
        this._dom.startRecordBtn = recControls.createEl("button", {
            text: "Start Recording",
            cls: "mod-cta voice-record-start-btn"
        });
        this._dom.startRecordBtn.addEventListener("click", () => this.handleStartRecording());

        this._dom.stopRecordBtn = recControls.createEl("button", {
            text: "Stop Recording",
            cls: "voice-record-stop-btn"
        });
        this._dom.stopRecordBtn.style.display = "none";
        this._dom.stopRecordBtn.addEventListener("click", () => this.handleStopRecording());

        // Playback controls (player + delete / again / submit)
        this._dom.playbackControls = sec.createEl("div", { cls: "playback-controls" });
        this._dom.playbackControls.style.display = "none";

        this._dom.audioPlayer = this._dom.playbackControls.createEl("audio", { cls: "voice-audio-player" });
        this._dom.audioPlayer.setAttribute("controls", "");

        const pbButtons = this._dom.playbackControls.createEl("div", { cls: "playback-buttons" });

        pbButtons.createEl("button", { text: "Delete", cls: "voice-delete-btn" })
            .addEventListener("click", () => this.handleDeleteRecording());
        pbButtons.createEl("button", { text: "Record Again", cls: "voice-record-again-btn" })
            .addEventListener("click", () => this.handleRecordAgain());
        pbButtons.createEl("button", { text: "Submit Recording", cls: "mod-cta voice-submit-btn" })
            .addEventListener("click", () => this.handleSubmitRecording());

        // Audio validation
        this._dom.audioValidationEl = sec.createEl("div", { cls: "flashcard-validation-message" });
        this._dom.audioValidationEl.style.display = "none";
    }

    renderExpectedAnswerSection(container) {
        this._dom.expectedAnswerContainer = container.createEl("div", {
            cls: "flashcard-expected-answer-content"
        });
        this._dom.expectedAnswerContainer.style.display = "none";
        this._dom.expectedAnswerContainer.createEl("h3", {
            text: "Expected Answer",
            cls: "flashcard-section-subtitle"
        });
        this._dom.expectedAnswerContainer.createEl("div", {
            text: this.expectedAnswer,
            cls: "flashcard-expected-answer-text"
        });
    }

    renderEvaluationSection(container) {
        this._dom.evaluationResultsContainer = container.createEl("div", {
            cls: "evaluation-results-container"
        });
        this._dom.evaluationResultsContainer.style.display = "none";
        this.evaluationRenderer = new EvaluationRenderer(this._dom.evaluationResultsContainer);
    }

    renderActionButtons(container) {
        const sec = container.createEl("div", { cls: "flashcard-button-section" });

        this._dom.revealBtn = sec.createEl("button", {
            text: "Reveal Expected Answer",
            cls: "mod-cta flashcard-reveal-button"
        });
        this._dom.revealBtn.addEventListener("click", () => this.toggleExpectedAnswer());

        this._dom.evaluateBtn = sec.createEl("button", {
            text: "Evaluate Answer",
            cls: "mod-cta flashcard-evaluate-button"
        });
        this._dom.evaluateBtn.addEventListener("click", () => this.handleEvaluateAnswer());

        sec.createEl("button", { text: "Copy Session", cls: "flashcard-copy-button" })
            .addEventListener("click", () => this.copySessionToClipboard());

        sec.createEl("button", { text: "Close", cls: "flashcard-close-button" })
            .addEventListener("click", () => this.close());
    }

    // ═══════════════════════════════════════════════════════════
    // Expected answer reveal / hide
    // ═══════════════════════════════════════════════════════════

    toggleExpectedAnswer() {
        this.isAnswerRevealed = !this.isAnswerRevealed;
        if (this.isAnswerRevealed) {
            this._dom.expectedAnswerContainer.style.display = "block";
            this._dom.revealBtn.textContent = "Hide Expected Answer";
        } else {
            this._dom.expectedAnswerContainer.style.display = "none";
            this._dom.revealBtn.textContent = "Reveal Expected Answer";
        }
    }

    // ═══════════════════════════════════════════════════════════
    // Validation helpers
    // ═══════════════════════════════════════════════════════════

    showValidation(message) {
        if (!this._dom.validationEl) return;
        if (message) {
            this._dom.validationEl.textContent = message;
            this._dom.validationEl.style.display = "block";
        } else {
            this._dom.validationEl.textContent = "";
            this._dom.validationEl.style.display = "none";
        }
    }

    showAudioValidation(message) {
        if (!this._dom.audioValidationEl) return;
        if (message) {
            this._dom.audioValidationEl.textContent = message;
            this._dom.audioValidationEl.style.display = "block";
        } else {
            this._dom.audioValidationEl.textContent = "";
            this._dom.audioValidationEl.style.display = "none";
        }
    }

    // ═══════════════════════════════════════════════════════════
    // Evaluate text answer
    // ═══════════════════════════════════════════════════════════

    async handleEvaluateAnswer() {
        const currentAnswer = this._dom.userAnswerTextarea.value.trim();
        this.userAnswer = currentAnswer;

        if (!currentAnswer) {
            this.showValidation("Please provide an answer before evaluating.");
            this._dom.userAnswerTextarea.focus();
            return;
        }

        if (!this.settings.apiKey) {
            new obsidian.Notice("API key not configured. Go to Settings \u2192 AI Spaced Repetition to add your key.");
            return;
        }

        if (this.isEvaluating) return;
        this.isEvaluating = true;
        this.showValidation("");
        this.setEvaluateButtonState("loading");

        try {
            const result = await this.aiService.evaluate(this.question, this.expectedAnswer, currentAnswer);
            this.evaluationResult = result;
            this.evaluationRenderer.render(result);
            this.setEvaluateButtonState("reevaluate");
        } catch (error) {
            console.error("AI Evaluation error:", error);
            this.showValidation(`Evaluation failed: ${error.message}`);
            this.setEvaluateButtonState(this.evaluationResult ? "reevaluate" : "idle");
        } finally {
            this.isEvaluating = false;
        }
    }

    setEvaluateButtonState(state) {
        if (!this._dom.evaluateBtn) return;
        const btn = this._dom.evaluateBtn;
        btn.disabled = false;
        btn.classList.remove("is-loading");

        if (state === "loading") {
            btn.textContent = "Evaluating...";
            btn.disabled = true;
            btn.classList.add("is-loading");
        } else if (state === "reevaluate") {
            btn.textContent = "Re-evaluate Answer";
        } else {
            btn.textContent = "Evaluate Answer";
        }
    }

    // ═══════════════════════════════════════════════════════════
    // Voice recording handlers
    // ═══════════════════════════════════════════════════════════

    async handleStartRecording() {
        if (this.audioRecorder.isRecording) return;
        this.showAudioValidation("");

        try {
            await this.audioRecorder.start(
                null, // onDataAvailable — not needed for UI
                (blob, mimeType, url) => { // onStopped
                    this._dom.audioPlayer.src = url;
                    this.setVoiceUIState("playback");
                },
                (error) => { // onError
                    this.showAudioValidation(error.message);
                    this.setVoiceUIState("idle");
                },
                (durationMs) => { // onTick
                    this._dom.recordingTimer.textContent = ` (${formatDuration(durationMs)})`;
                }
            );
            this.setVoiceUIState("recording");
        } catch (error) {
            this.showAudioValidation(error.message);
            this.setVoiceUIState("idle");
        }
    }

    handleStopRecording() {
        this.audioRecorder.stop();
        this.setVoiceUIState("stopped");
    }

    handleDeleteRecording() {
        this.audioRecorder.delete();
        this._dom.audioPlayer.src = "";
        this.setVoiceUIState("idle");
        this.showAudioValidation("");
    }

    handleRecordAgain() {
        this.handleDeleteRecording();
        this.handleStartRecording();
    }

    handleSubmitRecording() {
        const recorder = this.audioRecorder;
        if (!recorder.audioBlob || recorder.audioBlob.size === 0) {
            this.showAudioValidation("No valid recording to submit. Please record first.");
            return;
        }
        new obsidian.Notice(
            `Recording submitted!\n` +
            `Duration: ${formatDuration(recorder.recordingDurationMs)}\n` +
            `Size: ${formatBytes(recorder.audioBlob.size)}\n` +
            `Audio analysis will be implemented in a future milestone.`
        );
    }

    // ═══════════════════════════════════════════════════════════
    // Voice UI state machine
    // ═══════════════════════════════════════════════════════════

    setVoiceUIState(state) {
        const {
            recordingIndicator,
            startRecordBtn,
            stopRecordBtn,
            playbackControls
        } = this._dom;

        if (!recordingIndicator || !startRecordBtn || !stopRecordBtn || !playbackControls) return;

        if (state === "recording") {
            recordingIndicator.style.display = "flex";
            startRecordBtn.style.display = "none";
            stopRecordBtn.style.display = "inline-block";
            playbackControls.style.display = "none";
            this._dom.recordingTimer.textContent = " (00:00)";
        } else if (state === "stopped") {
            recordingIndicator.style.display = "none";
            startRecordBtn.style.display = "inline-block";
            stopRecordBtn.style.display = "none";
            playbackControls.style.display = "none";
        } else if (state === "playback") {
            recordingIndicator.style.display = "none";
            startRecordBtn.style.display = "none";
            stopRecordBtn.style.display = "none";
            playbackControls.style.display = "block";
        } else {
            // idle
            recordingIndicator.style.display = "none";
            startRecordBtn.style.display = "inline-block";
            stopRecordBtn.style.display = "none";
            playbackControls.style.display = "none";
            this._dom.recordingTimer.textContent = "";
        }
    }

    // ═══════════════════════════════════════════════════════════
    // Copy session
    // ═══════════════════════════════════════════════════════════

    copySessionToClipboard() {
        const userAnswer = this._dom.userAnswerTextarea
            ? this._dom.userAnswerTextarea.value.trim()
            : this.userAnswer;

        const report = compileSessionReport(
            this.question,
            this.expectedAnswer,
            userAnswer,
            this.audioRecorder.audioBlob,
            this.audioRecorder.recordingDurationMs,
            this.evaluationResult
        );

        navigator.clipboard.writeText(report).then(() => {
            new obsidian.Notice("Session copied to clipboard!");
        }).catch((err) => {
            console.error("Failed to copy:", err);
            new obsidian.Notice("Failed to copy session. Check browser permissions.");
        });
    }
}

module.exports = { FlashcardReviewModal };
