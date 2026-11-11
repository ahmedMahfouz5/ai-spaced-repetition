const { TranscribeClient, StartTranscriptionJobCommand, GetTranscriptionJobCommand } = require("@aws-sdk/client-transcribe");
const { AWSTranscriptionError } = require("./AWSError");

/**
 * Service for managing Amazon Transcribe batch jobs.
 */
class AWSTranscribeService {
    constructor(settings) {
        this.settings = settings;
        this.client = null;
    }

    /**
     * Lazily creates the Transcribe client from plugin settings.
     */
    getClient() {
        if (this.client) return this.client;

        const { awsRegion, awsAccessKeyId, awsSecretAccessKey } = this.settings;
        if (!awsRegion || !awsAccessKeyId || !awsSecretAccessKey) {
            throw new AWSTranscriptionError("AWS credentials are incomplete.", "missing_config");
        }

        this.client = new TranscribeClient({
            region: awsRegion,
            credentials: {
                accessKeyId: awsAccessKeyId,
                secretAccessKey: awsSecretAccessKey
            }
        });

        return this.client;
    }

    /**
     * Starts a transcription job.
     * @param {string} jobName - Unique job name.
     * @param {string} audioS3Uri - S3 URI of the input audio object.
     * @param {string} outputS3Uri - S3 URI prefix for the output transcript.
     * @param {string} languageCode - Language code (e.g., en-US).
     * @returns {Promise<string>} The job name.
     */
    async startJob(jobName, audioS3Uri, outputS3Uri, languageCode) {
        const client = this.getClient();

        const command = new StartTranscriptionJobCommand({
            TranscriptionJobName: jobName,
            LanguageCode: languageCode,
            Media: { MediaFileUri: audioS3Uri },
            OutputBucketName: this.settings.awsS3Bucket,
            OutputKey: outputS3Uri
        });

        try {
            const response = await client.send(command);
            if (!response.TranscriptionJob) {
                throw new AWSTranscriptionError("Transcribe did not return a job.", "job_creation_failed");
            }
            return response.TranscriptionJob.TranscriptionJobName || jobName;
        } catch (error) {
            throw this.classifyError(error, "Failed to start transcription job");
        }
    }

    /**
     * Polls a transcription job until completion or failure.
     * @param {string} jobName - The job name.
     * @param {Object} options - Polling options.
     * @param {AbortSignal} options.signal - AbortSignal for cancellation.
     * @param {number} options.intervalMs - Polling interval in milliseconds (default 4000).
     * @param {number} options.maxAttempts - Maximum poll attempts before timeout (default 180).
     * @returns {Promise<Object>} The completed job object.
     */
    async waitForJob(jobName, { signal, intervalMs = 4000, maxAttempts = 180 } = {}) {
        const client = this.getClient();

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            if (signal && signal.aborted) {
                throw new AWSTranscriptionError("Transcription was cancelled.", "cancelled");
            }

            let response;
            try {
                response = await client.send(new GetTranscriptionJobCommand({
                    TranscriptionJobName: jobName
                }));
            } catch (error) {
                throw this.classifyError(error, "Failed to check transcription job status");
            }

            const job = response.TranscriptionJob;
            if (!job) {
                throw new AWSTranscriptionError("Transcription job not found.", "job_not_found");
            }

            const status = job.TranscriptionJobStatus;
            if (status === "COMPLETED") {
                return job;
            }
            if (status === "FAILED") {
                const failureReason = job.FailureReason || "Unknown failure reason";
                throw new AWSTranscriptionError(`Transcription job failed: ${failureReason}`, "transcription_failed");
            }
            if (status === "QUEUED" || status === "IN_PROGRESS") {
                await this.delay(intervalMs);
                continue;
            }

            throw new AWSTranscriptionError(`Unexpected transcription job status: ${status}`, "unexpected_status");
        }

        throw new AWSTranscriptionError("Transcription job timed out.", "timeout");
    }

    /**
     * Extracts the transcript text from the completed job.
     * @param {Object} job - The completed TranscriptionJob object.
     * @param {Function} downloadFn - Function(key) that downloads the transcript JSON from S3.
     * @returns {Promise<string>} The transcript text.
     */
    async getTranscriptText(job, downloadFn) {
        const uri = job.Transcript && job.Transcript.TranscriptFileUri;
        if (!uri) {
            throw new AWSTranscriptionError("Transcription job completed but no transcript URI was returned.", "missing_transcript_uri");
        }

        // TranscriptFileUri looks like:
        // https://s3.<region>.amazonaws.com/<bucket>/<key>
        // or https://<bucket>.s3.<region>.amazonaws.com/<key>
        // Extract the key by parsing the URL and removing the leading bucket segment.
        let key;
        try {
            const url = new URL(uri);
            const path = decodeURIComponent(url.pathname);
            const segments = path.split("/").filter(Boolean);
            if (segments[0] === this.settings.awsS3Bucket) {
                key = segments.slice(1).join("/");
            } else {
                key = segments.join("/");
            }
        } catch (error) {
            throw new AWSTranscriptionError("Transcript URI could not be parsed.", "invalid_transcript_uri", error);
        }

        if (!key) {
            throw new AWSTranscriptionError("Could not determine transcript S3 key.", "invalid_transcript_uri");
        }

        const data = await downloadFn(key);
        if (!data || typeof data !== "object") {
            throw new AWSTranscriptionError("Transcript JSON has an unexpected format.", "invalid_response");
        }

        // Amazon Transcribe output format: { results: { transcripts: [{ transcript: "..." }], ... } }
        const transcripts = data.results && data.results.transcripts;
        if (!Array.isArray(transcripts) || transcripts.length === 0) {
            throw new AWSTranscriptionError("Transcript JSON does not contain any transcripts.", "empty_transcript");
        }

        const text = transcripts[0].transcript;
        if (typeof text !== "string" || text.trim().length === 0) {
            throw new AWSTranscriptionError("Transcription returned empty text.", "empty_transcript");
        }

        return text.trim();
    }

    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    classifyError(error, context) {
        const code = error.name || error.Code || error.code || "";
        const message = error.message || "";

        if (code === "AccessDeniedException" || code === "AccessDenied" || message.includes("AccessDenied")) {
            return new AWSTranscriptionError("AWS access denied. Check your IAM permissions.", "access_denied", error);
        }
        if (code === "BadRequestException" && /language/i.test(message)) {
            return new AWSTranscriptionError("Unsupported transcription language code.", "unsupported_language", error);
        }
        if (code === "InvalidAccessKeyId" || code === "SignatureDoesNotMatch") {
            return new AWSTranscriptionError("AWS credentials are invalid.", "invalid_credentials", error);
        }
        if (code === "NetworkingError" || message.includes("Network")) {
            return new AWSTranscriptionError("Network error while communicating with AWS.", "network", error);
        }

        return new AWSTranscriptionError(`${context}: ${message || code}`, "transcribe_error", error);
    }
}

module.exports = { AWSTranscribeService };
