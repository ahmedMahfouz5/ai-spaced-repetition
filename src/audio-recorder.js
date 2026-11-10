const { detectSupportedMimeType } = require("./utilities");

/**
 * Manages microphone recording via the MediaRecorder API.
 * Keeps audio in memory (Blob/URL) only — no filesystem persistence.
 */
class AudioRecorder {
    constructor() {
        this.audioBlob = null;
        this.audioURL = null;
        this.mediaRecorder = null;
        this.mediaStream = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.recordingDurationMs = 0;
        this.recordingTimerId = null;
    }

    /**
     * Returns the best MIME type supported by the browser's MediaRecorder.
     */
    getSupportedMimeType() {
        const detected = detectSupportedMimeType();
        if (!detected) {
            throw new Error("No supported audio format found. Your browser may not support MediaRecorder.");
        }
        return detected;
    }

    /**
     * Starts a new recording. Requests microphone permission on first call.
     * @param {Function} onDataAvailable - Called when a chunk arrives.
     * @param {Function} onStopped - Called with the final Blob and MIME type when stopped.
     * @param {Function} onError - Called if an error occurs.
     * @param {Function} onTick - Called every 100ms with current duration in ms.
     */
    async start(onDataAvailable, onStopped, onError, onTick) {
        if (this.isRecording) return;

        this.cleanup();

        try {
            const mimeType = this.getSupportedMimeType();
            this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.audioChunks = [];

            this.mediaRecorder = new MediaRecorder(this.mediaStream, { mimeType });

            this.mediaRecorder.addEventListener("dataavailable", (event) => {
                if (event.data && event.data.size > 0) {
                    this.audioChunks.push(event.data);
                    if (onDataAvailable) onDataAvailable(event.data);
                }
            });

            this.mediaRecorder.addEventListener("stop", () => {
                this.stopTimer();
                this.stopTracks();
                this.isRecording = false;

                if (this.audioChunks.length === 0) {
                    if (onError) onError(new Error("Recording produced no audio data."));
                    return;
                }

                this.audioBlob = new Blob(this.audioChunks, { type: mimeType });
                if (this.audioBlob.size === 0) {
                    if (onError) onError(new Error("Recording is empty."));
                    return;
                }

                this.audioURL = URL.createObjectURL(this.audioBlob);
                if (onStopped) onStopped(this.audioBlob, mimeType, this.audioURL);
            });

            this.mediaRecorder.addEventListener("error", (event) => {
                console.error("MediaRecorder error:", event);
                this.cleanup();
                if (onError) onError(new Error("Recording error occurred during capture."));
            });

            this.mediaRecorder.start(1000);
            this.isRecording = true;
            this.recordingDurationMs = 0;
            this.startTimer(onTick);

        } catch (error) {
            console.error("Failed to start recording:", error);
            this.cleanup();
            throw this.classifyError(error);
        }
    }

    /**
     * Stops the active recording. Triggers the 'stop' event listener.
     */
    stop() {
        if (!this.isRecording || !this.mediaRecorder) return;
        this.stopTimer();
        if (this.mediaRecorder.state !== "inactive") {
            this.mediaRecorder.stop();
        }
        this.stopTracks();
        this.isRecording = false;
    }

    /**
     * Deletes the current recording and releases all resources.
     */
    delete() {
        this.cleanup();
        this.audioBlob = null;
        this.audioChunks = [];
        this.recordingDurationMs = 0;
    }

    /**
     * Full cleanup: timer, recorder, stream tracks, object URLs.
     */
    cleanup() {
        this.stopTimer();

        if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
            try {
                this.mediaRecorder.stop();
            } catch (e) {
                // Already stopped
            }
        }

        this.stopTracks();

        if (this.audioURL) {
            URL.revokeObjectURL(this.audioURL);
            this.audioURL = null;
        }

        this.mediaRecorder = null;
        this.isRecording = false;
        this.audioChunks = [];
    }

    // ── Timer ──

    startTimer(onTick) {
        this.stopTimer();
        this.recordingTimerId = setInterval(() => {
            this.recordingDurationMs += 100;
            if (onTick) onTick(this.recordingDurationMs);
        }, 100);
    }

    stopTimer() {
        if (this.recordingTimerId) {
            clearInterval(this.recordingTimerId);
            this.recordingTimerId = null;
        }
    }

    // ── Media stream ──

    stopTracks() {
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach((track) => track.stop());
            this.mediaStream = null;
        }
    }

    // ── Error classification ──

    classifyError(error) {
        const name = error.name || "";
        if (name === "NotAllowedError" || name === "PermissionDeniedError") {
            return new Error("Microphone permission denied. Please allow microphone access.");
        }
        if (name === "NotFoundError" || name === "DevicesNotFoundError") {
            return new Error("No microphone found. Please connect a microphone.");
        }
        if (name === "NotReadableError" || name === "TrackStartError") {
            return new Error("Microphone is already in use by another application.");
        }
        return new Error(`Could not start recording: ${error.message}`);
    }
}

module.exports = { AudioRecorder };
