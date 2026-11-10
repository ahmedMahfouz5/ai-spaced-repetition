/**
 * Shared formatting and MIME type detection utilities.
 */

/**
 * Formats milliseconds into MM:SS string.
 */
function formatDuration(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Formats bytes into human-readable string (B, KB, MB).
 */
function formatBytes(bytes) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

/**
 * Capitalizes the first character of a string.
 */
function capitalizeFirst(str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Detects the best supported MIME type for MediaRecorder.
 * Prioritizes modern compressed formats over raw WAV.
 */
function detectSupportedMimeType() {
    const candidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg;codecs=opus",
        "audio/ogg",
        "audio/mp3",
        "audio/mpeg",
        "audio/wav"
    ];
    for (const type of candidates) {
        if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(type)) {
            return type;
        }
    }
    return "";
}

/**
 * Compiles a session report string from all session data.
 */
function compileSessionReport(question, expectedAnswer, userAnswer, audioBlob, recordingDurationMs, evaluationResult) {
    let text = `# Flashcard Session

## Question
${question}

## Your Answer
${userAnswer || "(no answer typed)"}
`;

    if (audioBlob && audioBlob.size > 0) {
        text += `\n**Voice Recording:** Yes (${formatDuration(recordingDurationMs)}, ${formatBytes(audioBlob.size)})\n`;
    } else {
        text += `\n**Voice Recording:** None\n`;
    }

    text += `\n## Expected Answer
${expectedAnswer}\n`;

    if (evaluationResult) {
        const r = evaluationResult;
        text += `
## AI Evaluation

**Score:** ${r.score}/100
**Verdict:** ${r.verdict.replace(/_/g, " ")}
**Suggested Rating:** ${r.suggested_rating}

### Technical Accuracy
${r.technical_accuracy}

### Strengths
${r.strengths.length > 0 ? r.strengths.map(s => `- ${s}`).join("\n") : "_None listed_"}

### Missing Concepts
${r.missing_concepts.length > 0 ? r.missing_concepts.map(m => `- ${m}`).join("\n") : "_None listed_"}

### Mistakes
${r.mistakes.length > 0 ? r.mistakes.map(m => `- ${m}`).join("\n") : "_None listed_"}

### Improved Answer
${r.improved_answer}

### Interview Feedback
${r.interview_feedback}
`;
    } else {
        text += `\n## AI Evaluation\n_Not evaluated yet._\n`;
    }

    return text;
}

module.exports = {
    formatDuration,
    formatBytes,
    capitalizeFirst,
    detectSupportedMimeType,
    compileSessionReport
};
