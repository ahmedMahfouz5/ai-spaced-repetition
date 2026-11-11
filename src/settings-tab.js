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

        const awsSection = containerEl.createEl("h3", { text: "AWS Speech-to-Text (Optional)" });
        awsSection.style.marginTop = "var(--size-4-4)";

        new obsidian.Setting(containerEl)
            .setName("Enable AWS Speech-to-Text")
            .setDesc("When enabled, audio recordings are transcribed using Amazon S3 + Amazon Transcribe instead of the OpenAI-compatible endpoint above. Existing text-answer and recording features remain unchanged when disabled.")
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.awsSTTEnabled)
                .onChange(async (value) => {
                    this.plugin.settings.awsSTTEnabled = value;
                    await this.plugin.saveSettings();
                    this.display();
                }));

        const security_warning = containerEl.createEl("div", {
            text: "⚠️ Security warning: storing long-lived AWS IAM access keys in plugin settings is risky. If your Obsidian vault or device is compromised, these credentials could be exposed. Use a dedicated IAM user with the minimum permissions below, rotate keys regularly, and consider lifecycle cleanup rules in S3.",
            cls: "aws-security-warning"
        });
        security_warning.style.color = "var(--text-error)";
        security_warning.style.fontSize = "var(--font-ui-smaller)";
        security_warning.style.marginBottom = "var(--size-4-3)";

        new obsidian.Setting(containerEl)
            .setName("AWS Region")
            .setDesc("The AWS region where your S3 bucket and Transcribe jobs will be created (e.g., us-east-2).")
            .addText(text => text
                .setPlaceholder("us-east-2")
                .setValue(this.plugin.settings.awsRegion)
                .onChange(async (value) => {
                    this.plugin.settings.awsRegion = value.trim();
                    await this.plugin.saveSettings();
                }));

        new obsidian.Setting(containerEl)
            .setName("S3 Bucket Name")
            .setDesc("Name of the private S3 bucket used to store temporary recordings and transcripts.")
            .addText(text => text
                .setPlaceholder("my-obsidian-stt-bucket")
                .setValue(this.plugin.settings.awsS3Bucket)
                .onChange(async (value) => {
                    this.plugin.settings.awsS3Bucket = value.trim();
                    await this.plugin.saveSettings();
                }));

        new obsidian.Setting(containerEl)
            .setName("AWS Access Key ID")
            .setDesc("Access key ID for the dedicated IAM user. Never share this value or commit it to Git.")
            .addText(text => {
                text.inputEl.type = "password";
                text.setPlaceholder("AKIA...")
                    .setValue(this.plugin.settings.awsAccessKeyId)
                    .onChange(async (value) => {
                        this.plugin.settings.awsAccessKeyId = value.trim();
                        await this.plugin.saveSettings();
                    });
            });

        new obsidian.Setting(containerEl)
            .setName("AWS Secret Access Key")
            .setDesc("Secret access key for the dedicated IAM user. Never share this value or commit it to Git.")
            .addText(text => {
                text.inputEl.type = "password";
                text.setPlaceholder("wJalrXUtnFEMI...")
                    .setValue(this.plugin.settings.awsSecretAccessKey)
                    .onChange(async (value) => {
                        this.plugin.settings.awsSecretAccessKey = value.trim();
                        await this.plugin.saveSettings();
                    });
            });

        new obsidian.Setting(containerEl)
            .setName("Transcription Language")
            .setDesc("Language code passed to Amazon Transcribe (e.g., en-US).")
            .addText(text => text
                .setPlaceholder("en-US")
                .setValue(this.plugin.settings.awsLanguageCode)
                .onChange(async (value) => {
                    this.plugin.settings.awsLanguageCode = value.trim();
                    await this.plugin.saveSettings();
                }));

        const permissionsHeader = containerEl.createEl("h4", { text: "Required IAM Permissions" });
        permissionsHeader.style.marginTop = "var(--size-4-4)";

        const policyText = `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "transcribe:StartTranscriptionJob",
        "transcribe:GetTranscriptionJob"
      ],
      "Resource": "*"
    }
  ]
}`;

        const policyCode = containerEl.createEl("pre", {
            text: policyText,
            cls: "aws-policy-code"
        });
        policyCode.style.backgroundColor = "var(--background-primary-alt)";
        policyCode.style.padding = "var(--size-4-2)";
        policyCode.style.borderRadius = "var(--radius-s)";
        policyCode.style.fontSize = "var(--font-ui-smaller)";
        policyCode.style.overflow = "auto";

        const lifecycleNote = containerEl.createEl("div", {
            text: "Tip: add a lifecycle rule to expire objects under recordings/ and transcripts/ after 1 day as a fallback cleanup mechanism.",
            cls: "aws-lifecycle-note"
        });
        lifecycleNote.style.fontSize = "var(--font-ui-smaller)";
        lifecycleNote.style.marginTop = "var(--size-4-2)";
        lifecycleNote.style.color = "var(--text-muted)";
    }
}
module.exports = { AISpacedRepetitionSettingTab };

