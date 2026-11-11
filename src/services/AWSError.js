/**
 * Custom error class for AWS transcription failures.
 */
class AWSTranscriptionError extends Error {
    constructor(message, code, originalError = null) {
        super(message);
        this.name = "AWSTranscriptionError";
        this.code = code;
        this.originalError = originalError;
    }
}

module.exports = { AWSTranscriptionError };
