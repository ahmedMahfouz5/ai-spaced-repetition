const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { AWSTranscriptionError } = require("./AWSError");

/**
 * Service for interacting with a private S3 bucket.
 * Uploads recordings, downloads transcript JSON, and cleans up temporary objects.
 */
class AWSS3Service {
    constructor(settings) {
        this.settings = settings;
        this.client = null;
    }

    /**
     * Lazily creates the S3 client from plugin settings.
     */
    getClient() {
        if (this.client) return this.client;

        const { awsRegion, awsAccessKeyId, awsSecretAccessKey } = this.settings;
        if (!awsRegion || !awsAccessKeyId || !awsSecretAccessKey) {
            throw new AWSTranscriptionError("AWS credentials are incomplete.", "missing_config");
        }

        this.client = new S3Client({
            region: awsRegion,
            credentials: {
                accessKeyId: awsAccessKeyId,
                secretAccessKey: awsSecretAccessKey
            }
        });

        return this.client;
    }

    /**
     * Uploads an audio Blob to the configured S3 bucket.
     * @param {string} key - S3 object key.
     * @param {Blob} blob - Audio data.
     */
    async uploadAudio(key, blob) {
        const client = this.getClient();
        const bucket = this.settings.awsS3Bucket;
        if (!bucket) throw new AWSTranscriptionError("S3 bucket name is not configured.", "missing_config");

        const buffer = await blob.arrayBuffer();

        try {
            await client.send(new PutObjectCommand({
                Bucket: bucket,
                Key: key,
                Body: new Uint8Array(buffer),
                ContentType: blob.type || "audio/webm"
            }));
        } catch (error) {
            throw this.classifyError(error, "Failed to upload audio to S3");
        }
    }

    /**
     * Downloads a transcript JSON object from S3 and returns the parsed object.
     * @param {string} key - S3 object key.
     * @returns {Promise<Object>} Parsed JSON object.
     */
    async downloadTranscriptJson(key) {
        const client = this.getClient();
        const bucket = this.settings.awsS3Bucket;
        if (!bucket) throw new AWSTranscriptionError("S3 bucket name is not configured.", "missing_config");

        let response;
        try {
            response = await client.send(new GetObjectCommand({
                Bucket: bucket,
                Key: key
            }));
        } catch (error) {
            throw this.classifyError(error, "Failed to download transcript from S3");
        }

        const body = await response.Body;
        if (!body) {
            throw new AWSTranscriptionError("Transcript object body is empty.", "empty_transcript");
        }

        // The SDK returns a streaming body. Convert it to text, then JSON.
        const text = await this.streamToString(body);
        try {
            return JSON.parse(text);
        } catch (error) {
            throw new AWSTranscriptionError("Transcript JSON is malformed.", "invalid_response", error);
        }
    }

    /**
     * Deletes an object from S3. Failures are logged but not thrown.
     * @param {string} key - S3 object key.
     */
    async deleteObject(key) {
        const client = this.getClient();
        const bucket = this.settings.awsS3Bucket;
        if (!bucket || !client) return;

        try {
            await client.send(new DeleteObjectCommand({
                Bucket: bucket,
                Key: key
            }));
        } catch (error) {
            // Do not expose bucket/key details in errors.
            console.warn("AWS STT: failed to delete temporary S3 object.", error.message || error.name);
        }
    }

    /**
     * Converts a stream body to a string.
     */
    async streamToString(stream) {
        if (typeof stream === "string") return stream;
        if (stream instanceof ArrayBuffer) return new TextDecoder().decode(stream);
        if (stream instanceof Uint8Array) return new TextDecoder().decode(stream);

        const chunks = [];
        const reader = stream.getReader ? stream.getReader() : null;
        if (!reader) {
            return String(stream);
        }

        // eslint-disable-next-line no-constant-condition
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
        }

        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const combined = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
            combined.set(chunk, offset);
            offset += chunk.length;
        }
        return new TextDecoder().decode(combined);
    }

    /**
     * Classifies AWS SDK errors into safe, user-facing messages.
     */
    classifyError(error, context) {
        const code = error.name || error.Code || error.code || "";
        const message = error.message || "";

        if (/failed to fetch|cors|access-control|network/i.test(message)) {
            return new AWSTranscriptionError(
                "Could not reach AWS S3. If you are using AWS Speech-to-Text, make sure your S3 bucket CORS policy allows the app://obsidian.md origin (or *) and that the bucket name and region are correct.",
                "network",
                error
            );
        }
        if (code === "NoSuchBucket" || message.includes("NoSuchBucket")) {
            return new AWSTranscriptionError("The configured S3 bucket does not exist.", "s3_bucket_missing", error);
        }
        if (code === "AccessDenied" || message.includes("AccessDenied") || message.includes("Forbidden")) {
            return new AWSTranscriptionError("AWS access denied. Check your IAM permissions.", "access_denied", error);
        }
        if (code === "InvalidAccessKeyId" || code === "SignatureDoesNotMatch") {
            return new AWSTranscriptionError("AWS credentials are invalid.", "invalid_credentials", error);
        }
        if (code === "NetworkingError" || message.includes("Network")) {
            return new AWSTranscriptionError("Network error while communicating with AWS.", "network", error);
        }

        return new AWSTranscriptionError(`${context}: ${message || code}`, "s3_error", error);
    }
}

module.exports = { AWSS3Service };

