const obsidian = require("obsidian");
const { AWSSTTService } = require("./AWSSTTService");
const { AWSTranscriptionError } = require("./AWSError");

/**
 * Maximum recording size allowed by the transcription endpoint (25 MB).
 */
const MAX_TRANSCRIPTION_SIZE_BYTES = 25 * 1024 * 1024;

/**
 * Default timeout for a transcription request (30 seconds).
 */
const TRANSCRIPTION_TIMEOUT_MS = 30000;

/**
 * Maps common browser audio MIME types to file extensions accepted by
 * OpenAI-compatible audio transcriptions endpoints.
 */
const MIME_TYPE_TO_EXTENSION = {
    "audio/webm": "webm",
    "audio/webm;codecs=opus": "webm",
    "audio/mp4": "m4a",
    "audio/ogg": "ogg",
    "audio/ogg;codecs=opus": "ogg",
    "audio/mp3": "mp3",
    "audio/mpeg": "mp3",
    "audio/wav": "wav"
};

/**
 * Service responsible for sending an audio Blob to a transcription endpoint
 * and returning the recognized text.
 */
class TranscriptionService {
    constructor(settings) {
        this.settings = settings;
    }

    /**
     * Sends an audio Blob to the configured transcription endpoint and returns
     * the recognized text.
     *
     * @param {Blob} audioBlob - The recorded audio data.
     * @param {string} mimeType - The MIME type of the recorded audio.
     * @param {Object} options - Optional parameters.
     * @param {AbortSignal} options.signal - AbortSignal for cancelling AWS polling.
     * @returns {Promise<string>} The transcribed text.
     */
    async transcribe(audioBlob, mimeType, { signal } = {}) {
        if (!audioBlob || !(audioBlob instanceof Blob) || audioBlob.size === 0) {
            throw new TranscriptionError("No audio recording available.", "missing_audio");
        }

        if (this.settings.awsSTTEnabled) {
            const awsService = new AWSSTTService(this.settings);
            if (awsService.isEnabled()) {
                return await awsService.transcribe(audioBlob, mimeType, { signal });
            }
        }

        if (audioBlob.size > MAX_TRANSCRIPTION_SIZE_BYTES) {
            throw new TranscriptionError(
                `Recording is too large (${this.formatBytes(audioBlob.size)}). Maximum is 25 MB.`,
                "oversized"
            );
        }

        const extension = this.getExtensionForMimeType(mimeType);
        if (!extension) {
            throw new TranscriptionError(
                `Unsupported audio format: ${mimeType}.`,
                "unsupported_format"
            );
        }

        const model = this.settings.transcriptionModel || this.settings.model;
        const requestBody = await this.buildRequestBody(audioBlob, extension, model);

        let response;
        try {
            response = await this.makeRequest(requestBody);
        } catch (error) {
            if (error.name === "AbortError" || /timeout/i.test(error.message)) {
                throw new TranscriptionError(
                    "Transcription request timed out. Try a shorter recording.",
                    "timeout"
                );
            }
            if (error.status === 401) {
                throw new TranscriptionError(
                    "Transcription failed: invalid API key. Check your settings.",
                    "authentication"
                );
            }
            throw new TranscriptionError(
                `Transcription failed: ${error.message || error}`,
                "network"
            );
        }

        return this.parseResponse(response);
    }

    /**
     * Builds a multipart/form-data body from the audio Blob.
     *
     * @param {Blob} audioBlob
     * @param {string} extension
     * @param {string} model
     * @returns {Promise<{body: ArrayBuffer, headers: Object}>}
     */
    async buildRequestBody(audioBlob, extension, model) {
        const boundary = `----FormBoundary${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
        const filename = `recording.${extension}`;
        const contentType = audioBlob.type || `audio/${extension}`;

        const preamble = `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="model"\r\n\r\n` +
            `${model}\r\n` +
            `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
            `Content-Type: ${contentType}\r\n\r\n`;

        const postamble = `\r\n--${boundary}--\r\n`;

        const audioBuffer = await audioBlob.arrayBuffer();
        const preambleBuffer = new TextEncoder().encode(preamble);
        const postambleBuffer = new TextEncoder().encode(postamble);

        const combined = new Uint8Array(
            preambleBuffer.length + audioBuffer.byteLength + postambleBuffer.length
        );

        let offset = 0;
        combined.set(preambleBuffer, offset);
        offset += preambleBuffer.length;
        combined.set(new Uint8Array(audioBuffer), offset);
        offset += audioBuffer.byteLength;
        combined.set(postambleBuffer, offset);

        return {
            body: combined.buffer,
            headers: {
                "Content-Type": `multipart/form-data; boundary=${boundary}`
            }
        };
    }

    /**
     * Performs the HTTP POST to the transcription endpoint with a timeout.
     */
    async makeRequest(requestBody) {
        const url = this.settings.transcriptionBaseURL || `${this.settings.baseURL}/audio/transcriptions`;
        const apiKey = this.settings.transcriptionApiKey || this.settings.apiKey;
        const headers = {
            ...requestBody.headers,
            "Authorization": `Bearer ${apiKey}`
        };

        const requestPromise = obsidian.requestUrl({
            url,
            method: "POST",
            headers,
            body: requestBody.body
        });

        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error("timeout"));
            }, TRANSCRIPTION_TIMEOUT_MS);
        });

        return await Promise.race([requestPromise, timeoutPromise]);
    }

    /**
     * Parses the transcription endpoint response and returns the text.
     */
    parseResponse(response) {
        if (!response || response.status < 200 || response.status >= 300) {
            const status = response ? response.status : "unknown";
            let errorType = "network";
            let msg = `Transcription failed with HTTP ${status}.`;

            if (status === 401) {
                errorType = "authentication";
                msg = "Transcription failed: invalid API key.";
            } else if (status === 404) {
                errorType = "endpoint_not_found";
                msg = "Transcription endpoint not found (404). Check the configured provider endpoint.";
            }

            throw new TranscriptionError(msg, errorType);
        }

        const data = response.json;
        if (!data || typeof data.text !== "string") {
            throw new TranscriptionError("Invalid transcription response format.", "invalid_response");
        }

        const text = data.text.trim();
        if (text.length === 0) {
            throw new TranscriptionError("Transcription returned empty text.", "empty_transcript");
        }

        return text;
    }

    /**
     * Returns the accepted file extension for a given MIME type.
     */
    getExtensionForMimeType(mimeType) {
        if (!mimeType) return null;
        return MIME_TYPE_TO_EXTENSION[mimeType.toLowerCase()] || null;
    }

    /**
     * Formats a byte count into a human-readable string.
     */
    formatBytes(bytes) {
        if (bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
    }
}

/**
 * Custom error class for transcription failures.
 */
class TranscriptionError extends Error {
    constructor(message, code) {
        super(message);
        this.name = "TranscriptionError";
        this.code = code;
    }
}

module.exports = { TranscriptionService, TranscriptionError, MAX_TRANSCRIPTION_SIZE_BYTES };

