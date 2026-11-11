/**
 * Constants used across the plugin.
 */

const DEFAULT_SETTINGS = {
    apiKey: "",
    baseURL: "https://backend.sovereigneg.com/v1",
    model: "kimi-k3",
    transcriptionBaseURL: "",
    transcriptionApiKey: "",
    transcriptionModel: "whisper-1",
    awsSTTEnabled: false,
    awsRegion: "us-east-2",
    awsS3Bucket: "",
    awsAccessKeyId: "",
    awsSecretAccessKey: "",
    awsLanguageCode: "en-US"
};

const VALID_VERDICTS = ["correct", "partially_correct", "incorrect"];
const VALID_RATINGS = ["Again", "Hard", "Good", "Easy"];

module.exports = {
    DEFAULT_SETTINGS,
    VALID_VERDICTS,
    VALID_RATINGS
};

