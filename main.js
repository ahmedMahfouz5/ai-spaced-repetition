const obsidian = require("obsidian");

module.exports = class AISpacedRepetition extends obsidian.Plugin {

    async onload() {

        console.log("AI Spaced Repetition: Plugin loaded");

        // Register command in Obsidian Command Palette
        this.addCommand({
            id: "open-ai-review",
            name: "Open AI Review",
            callback: () => {
                new FlashcardReviewModal(this.app).open();
            }
        });

        // Display notification when plugin loads
        new obsidian.Notice("AI Spaced Repetition loaded!");
    }

    onunload() {

        console.log("AI Spaced Repetition: Plugin unloaded");

    }
};


// Flashcard Review Modal
class FlashcardReviewModal extends obsidian.Modal {

    constructor(app) {
        super(app);
        
        // Hardcoded test flashcard
        this.question = "What is the difference between Kubernetes Deployment and StatefulSet?";
        this.expectedAnswer = "A Deployment manages stateless applications using ReplicaSets, while a StatefulSet manages stateful applications and provides stable network identities and persistent storage associations.";
        
        // State management
        this.isAnswerRevealed = false;
        this.userAnswer = "";
        this.validationMessage = null;
        
        // DOM elements for dynamic updates
        this.expectedAnswerContainer = null;
        this.userAnswerTextarea = null;
        this.revealButton = null;
        this.validationElement = null;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        // Add CSS class for styling
        contentEl.classList.add("ai-spaced-repetition-modal");
        
        this.renderQuestionSection(contentEl);
        this.renderUserAnswerSection(contentEl);
        this.renderExpectedAnswerSection(contentEl);
        this.renderActionButtons(contentEl);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }

    /**
     * Renders the question section
     */
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

    /**
     * Renders the user answer section with textarea
     */
    renderUserAnswerSection(container) {
        const answerSection = container.createEl("div", {
            cls: "flashcard-user-answer-section"
        });
        
        answerSection.createEl("h3", {
            text: "Your Answer",
            cls: "flashcard-section-subtitle"
        });
        
        // Textarea for user input
        this.userAnswerTextarea = answerSection.createEl("textarea", {
            cls: "flashcard-textarea"
        });
        
        this.userAnswerTextarea.setAttribute("rows", "6");
        this.userAnswerTextarea.setAttribute("placeholder", "Type your answer here...");
        
        // Restore any existing user answer
        this.userAnswerTextarea.value = this.userAnswer;
        
        // Update stored answer on input
        this.userAnswerTextarea.addEventListener("input", (event) => {
            this.userAnswer = event.target.value;
            this.clearValidationMessage();
        });
        
        // Validation message container
        this.validationElement = answerSection.createEl("div", {
            cls: "flashcard-validation-message"
        });
        this.validationElement.style.display = "none";
    }

    /**
     * Renders the expected answer section (initially hidden)
     */
    renderExpectedAnswerSection(container) {
        const expectedSection = container.createEl("div", {
            cls: "flashcard-expected-answer-section"
        });
        
        // Container for the expected answer content
        this.expectedAnswerContainer = expectedSection.createEl("div", {
            cls: "flashcard-expected-answer-content"
        });
        
        // Initially hidden
        this.expectedAnswerContainer.style.display = "none";
        
        // Header for expected answer
        this.expectedAnswerContainer.createEl("h3", {
            text: "Expected Answer",
            cls: "flashcard-section-subtitle"
        });
        
        // Expected answer text
        this.expectedAnswerContainer.createEl("div", {
            text: this.expectedAnswer,
            cls: "flashcard-expected-answer-text"
        });
    }

    /**
     * Renders action buttons
     */
    renderActionButtons(container) {
        const buttonSection = container.createEl("div", {
            cls: "flashcard-button-section"
        });
        
        // Reveal/Hide button
        this.revealButton = buttonSection.createEl("button", {
            text: "Reveal Expected Answer",
            cls: "mod-cta flashcard-reveal-button"
        });
        
        this.revealButton.addEventListener("click", () => {
            this.toggleExpectedAnswer();
        });
        
        // Evaluate button
        const evaluateButton = buttonSection.createEl("button", {
            text: "Evaluate Answer",
            cls: "mod-cta flashcard-evaluate-button"
        });
        
        evaluateButton.addEventListener("click", () => {
            this.evaluateAnswer();
        });
        
        // Close button
        const closeButton = buttonSection.createEl("button", {
            text: "Close",
            cls: "flashcard-close-button"
        });
        
        closeButton.addEventListener("click", () => {
            this.close();
        });
    }

    /**
     * Toggles the visibility of the expected answer
     */
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

    /**
     * Validates user input and displays validation message
     */
    showValidationMessage(message) {
        if (this.validationElement) {
            this.validationElement.textContent = message;
            this.validationElement.style.display = "block";
        }
    }

    /**
     * Clears the validation message
     */
    clearValidationMessage() {
        if (this.validationElement) {
            this.validationElement.textContent = "";
            this.validationElement.style.display = "none";
        }
    }

    /**
     * Handles answer evaluation
     */
    evaluateAnswer() {
        // Get current value from textarea
        this.userAnswer = this.userAnswerTextarea.value.trim();
        
        // Validate empty answer
        if (!this.userAnswer) {
            this.showValidationMessage("Please provide an answer before evaluating.");
            // Focus the textarea
            this.userAnswerTextarea.focus();
            return;
        }
        
        // Clear any previous validation
        this.clearValidationMessage();
        
        // Temporary notification for future AI integration
        new obsidian.Notice("Answer evaluation will be implemented in a future milestone.");
    }
}