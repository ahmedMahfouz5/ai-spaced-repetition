/**
 * Renders AI evaluation results into a DOM container.
 * Pure rendering — no API logic, no state management.
 */
class EvaluationRenderer {
    constructor(container) {
        this.container = container;
    }

    /**
     * Clears previous results and renders a full evaluation block.
     */
    render(result) {
        if (!this.container) return;
        const c = this.container;
        c.empty();
        c.style.display = "block";

        this.renderScoreAndVerdict(c, result);
        this.renderSection(c, "Technical Accuracy", result.technical_accuracy, "evaluation-technical-accuracy");

        if (result.strengths && result.strengths.length > 0) {
            this.renderList(c, "Strengths", result.strengths, "evaluation-strengths");
        }
        if (result.missing_concepts && result.missing_concepts.length > 0) {
            this.renderList(c, "Missing Concepts", result.missing_concepts, "evaluation-missing");
        }
        if (result.mistakes && result.mistakes.length > 0) {
            this.renderList(c, "Mistakes", result.mistakes, "evaluation-mistakes");
        }
        if (result.improved_answer) {
            this.renderSection(c, "Improved Answer", result.improved_answer, "evaluation-improved");
        }
        if (result.interview_feedback) {
            this.renderSection(c, "Interview Feedback", result.interview_feedback, "evaluation-feedback");
        }

        this.renderRating(c, result.suggested_rating);
    }

    renderScoreAndVerdict(container, result) {
        const scoreSec = container.createEl("div", { cls: "evaluation-score-section" });
        scoreSec.createEl("div", {
            text: `${result.score}`,
            cls: `evaluation-score ${this.scoreClass(result.score)}`
        });
        scoreSec.createEl("div", {
            text: this.capitalizeFirst(result.verdict.replace(/_/g, " ")),
            cls: `evaluation-verdict verdict-${result.verdict}`
        });
    }

    renderSection(container, title, content, cls) {
        const sec = container.createEl("div", { cls: `evaluation-section ${cls}` });
        sec.createEl("h4", { text: title, cls: "evaluation-section-title" });
        sec.createEl("div", { text: content, cls: "evaluation-section-content" });
    }

    renderList(container, title, items, cls) {
        const sec = container.createEl("div", { cls: `evaluation-section ${cls}` });
        sec.createEl("h4", { text: title, cls: "evaluation-section-title" });
        const list = sec.createEl("ul", { cls: "evaluation-list" });
        for (const item of items) {
            list.createEl("li", { text: item, cls: "evaluation-list-item" });
        }
    }

    renderRating(container, rating) {
        const ratingSec = container.createEl("div", { cls: "evaluation-rating-section" });
        ratingSec.createEl("h4", { text: "Suggested Rating", cls: "evaluation-rating-title" });
        ratingSec.createEl("span", {
            text: rating,
            cls: `evaluation-rating rating-${rating.toLowerCase()}`
        });
    }

    scoreClass(score) {
        if (score >= 80) return "score-excellent";
        if (score >= 60) return "score-good";
        if (score >= 40) return "score-fair";
        return "score-poor";
    }

    capitalizeFirst(str) {
        if (!str) return "";
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
}

module.exports = { EvaluationRenderer };
