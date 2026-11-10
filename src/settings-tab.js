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
    }
}

module.exports = { AISpacedRepetitionSettingTab };
