const obsidian = require("obsidian");

/**
 * Settings tab for configuring the AI API connection.
 */
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

        const transcriptionSection = containerEl.createEl("h3", { text: "Transcription (STT)" });
        transcriptionSection.style.marginTop = "var(--size-4-4)";

        new obsidian.Setting(containerEl)
            .setName("Transcription Base URL")
            .setDesc("Full URL of the OpenAI-compatible audio transcriptions endpoint. Leave empty to use the main Base URL with /audio/transcriptions appended.")
            .addText(text => text
                .setPlaceholder("https://api.openai.com/v1/audio/transcriptions")
                .setValue(this.plugin.settings.transcriptionBaseURL)
                .onChange(async (value) => {
                    this.plugin.settings.transcriptionBaseURL = value.trim();
                    await this.plugin.saveSettings();
                }));

        new obsidian.Setting(containerEl)
            .setName("Transcription Model")
            .setDesc("Model name to use for audio transcription (e.g., whisper-1).")
            .addText(text => text
                .setPlaceholder("whisper-1")
                .setValue(this.plugin.settings.transcriptionModel)
                .onChange(async (value) => {
                    this.plugin.settings.transcriptionModel = value.trim();
                    await this.plugin.saveSettings();
                }));

        new obsidian.Setting(containerEl)
            .setName("Transcription API Key")
            .setDesc("Optional. API key for the transcription provider. Leave empty to use the main API key.")
            .addText(text => {
                text.inputEl.type = "password";
                text.setPlaceholder("sk-...")
                    .setValue(this.plugin.settings.transcriptionApiKey)
                    .onChange(async (value) => {
                        this.plugin.settings.transcriptionApiKey = value.trim();
                        await this.plugin.saveSettings();
                    });
            });
    }
}

module.exports = { AISpacedRepetitionSettingTab };

