const { AWSS3Service } = require("./AWSS3Service");
const { AWSTranscribeService } = require("./AWSTranscribeService");
const { AWSTranscriptionError } = require("./AWSError");

const LOG_PREFIX = "AWS STT:";

const REQUIRED_SETTINGS = Object.freeze([
    "awsRegion",
    "awsS3Bucket",
    "awsAccessKeyId",
    "awsSecretAccessKey",
    "awsLanguageCode"
]);

const MIME_TYPE_TO_EXTENSION = Object.freeze({
    "audio/webm": "webm",
    "audio/mp4": "m4a",
    "audio/ogg": "ogg",
    "audio/mp3": "mp3",
    "audio/mpeg": "mp3",
    "audio/wav": "wav"
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function randomChunk() {
    return Math.random().toString(36).slice(2, 10);
}

function generateId() {
    return `${Date.now()}-${randomChunk()}-${randomChunk()}`;
}

const now = () => performance.now();
const secondsSince = (start) => ((now() - start) / 1000).toFixed(2);
const log = (message) => console.log(`${LOG_PREFIX} ${message}`);

function throwIfCancelled(signal) {
    if (signal?.aborted) {
        throw new AWSTranscriptionError("Transcription was cancelled.", "cancelled");
    }
}

/**
 * Runs an async step and logs how long it took (even if it throws).
 */
async function timedStep(label, fn) {
    const start = now();
    try {
        return await fn();
    } finally {
        log(`${label} took ${secondsSince(start)}s`);
    }
}

/**
 * Builds all the S3 keys / URIs / job name used by a single transcription run.
 */
function buildJobResources(bucket, extension) {
    const id = generateId();
    const transcriptPrefix = `transcripts/${id}/`;
    const recordingKey = `recordings/${id}/recording.${extension}`;

    return {
        jobName: `obsidian-stt-${id}`,
        recordingKey,
        transcriptKey: `${transcriptPrefix}transcript.json`,
        transcriptPrefix,
        audioS3Uri: `s3://${bucket}/${recordingKey}`
    };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Orchestrates the full AWS speech-to-text workflow:
 *   validate settings -> upload audio to S3 -> start Transcribe job -> poll ->
 *   download transcript -> extract text -> cleanup S3 objects.
 */
class AWSSTTService {
    constructor(settings) {
        this.settings = settings;
        this.s3 = new AWSS3Service(settings);
        this.transcribeService = new AWSTranscribeService(settings);
    }

    /**
     * Returns true if AWS STT is enabled.
     */
    isEnabled() {
        return Boolean(this.settings.awsSTTEnabled);
    }

    /**
     * Validates the required AWS settings. Throws AWSTranscriptionError if incomplete.
     */
    validateConfiguration() {
        const missing = REQUIRED_SETTINGS.filter((key) => {
            const value = this.settings[key];
            return typeof value !== "string" || value.trim().length === 0;
        });

        if (missing.length > 0) {
            throw new AWSTranscriptionError(
                `AWS Speech-to-Text is missing required settings: ${missing.join(", ")}.`,
                "missing_config"
            );
        }
    }

    /**
     * Maps a MIME type (with or without codec params) to a file extension.
     * @returns {string|null}
     */
    getExtensionForMimeType(mimeType) {
        if (!mimeType) return null;

        const normalized = mimeType.toLowerCase().replace(/\s+/g, "");
        const baseType = normalized.split(";")[0];

        return MIME_TYPE_TO_EXTENSION[baseType] ?? null;
    }

    /**
     * Transcribes an audio Blob using Amazon Transcribe.
     * Logs per-step timings and the total time from upload start until the text is ready.
     *
     * @param {Blob} audioBlob - Recorded audio.
     * @param {string} mimeType - Audio MIME type.
     * @param {Object} [options]
     * @param {AbortSignal} [options.signal] - Cancellation signal.
     * @returns {Promise<string>} Transcribed text.
     */
    async transcribe(audioBlob, mimeType, { signal } = {}) {
        if (!(audioBlob instanceof Blob) || audioBlob.size === 0) {
            throw new AWSTranscriptionError("No audio recording available.", "missing_audio");
        }

        this.validateConfiguration();

        const extension = this.getExtensionForMimeType(mimeType);
        if (!extension) {
            throw new AWSTranscriptionError(`Unsupported audio format: ${mimeType}.`, "unsupported_format");
        }

        const { jobName, recordingKey, transcriptKey, transcriptPrefix, audioS3Uri } =
            buildJobResources(this.settings.awsS3Bucket, extension);

        const startTime = now();

        try {
            throwIfCancelled(signal);

            await timedStep("upload", () => this.s3.uploadAudio(recordingKey, audioBlob));
            throwIfCancelled(signal);

            await timedStep("start job", () =>
                this.transcribeService.startJob(
                    jobName,
                    audioS3Uri,
                    transcriptPrefix,
                    this.settings.awsLanguageCode
                )
            );

            const job = await timedStep("waiting for job", () =>
                this.transcribeService.waitForJob(jobName, { signal })
            );

            const text = await timedStep("transcript download/extract", () =>
                this.transcribeService.getTranscriptText(job, (key) =>
                    this.s3.downloadTranscriptJson(key)
                )
            );

            log(`total time (upload -> text ready) = ${secondsSince(startTime)}s`);
            return text;
        } catch (error) {
            log(`failed after ${secondsSince(startTime)}s`);
            throw error;
        } finally {
            // Best-effort cleanup on both success and failure; never masks the original error.
            await this.cleanup(recordingKey, transcriptKey);
        }
    }

    /**
     * Deletes temporary S3 objects. Never throws.
     */
    async cleanup(recordingKey, transcriptKey) {
        const results = await Promise.allSettled([
            this.s3.deleteObject(recordingKey),
            this.s3.deleteObject(transcriptKey)
        ]);

        for (const result of results) {
            if (result.status === "rejected") {
                console.warn(`${LOG_PREFIX} cleanup encountered an error:`, result.reason?.message ?? result.reason);
            }
        }
    }
}

module.exports = { AWSSTTService };