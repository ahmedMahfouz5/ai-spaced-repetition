const obsidian = require("obsidian");
const { DEFAULT_SETTINGS } = require("./src/constants");
const { AISpacedRepetitionSettingTab } = require("./src/settings-tab");
const { FlashcardReviewModal } = require("./src/flashcard-modal");

/**
 * AI Spaced Repetition Plugin for Obsidian.
 * Entry point — delegates to modular components in src/.
 */
class AISpacedRepetition extends obsidian.Plugin {

    async onload() {
        console.log("AI Spaced Repetition: Plugin loaded");

        await this.loadSettings();

        this.addCommand({
            id: "open-ai-review",
            name: "Open AI Review",
            callback: () => {
                new FlashcardReviewModal(this.app, this.settings).open();
            }
        });

        this.addSettingTab(new AISpacedRepetitionSettingTab(this.app, this));

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
}

module.exports = AISpacedRepetition;

