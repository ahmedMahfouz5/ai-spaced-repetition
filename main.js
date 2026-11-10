var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};

// src/constants.js
var require_constants = __commonJS({
  "src/constants.js"(exports2, module2) {
    var DEFAULT_SETTINGS2 = {
      apiKey: "",
      baseURL: "https://backend.sovereigneg.com/v1",
      model: "kimi-k3",
      transcriptionBaseURL: "",
      transcriptionApiKey: "",
      transcriptionModel: "whisper-1"
    };
    var VALID_VERDICTS = ["correct", "partially_correct", "incorrect"];
    var VALID_RATINGS = ["Again", "Hard", "Good", "Easy"];
    module2.exports = {
      DEFAULT_SETTINGS: DEFAULT_SETTINGS2,
      VALID_VERDICTS,
      VALID_RATINGS
    };
  }
});

// src/settings-tab.js
var require_settings_tab = __commonJS({
  "src/settings-tab.js"(exports2, module2) {
    var obsidian2 = require("obsidian");
    var AISpacedRepetitionSettingTab2 = class extends obsidian2.PluginSettingTab {
      constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
      }
      display() {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl("h2", { text: "AI Spaced Repetition Settings" });
        new obsidian2.Setting(containerEl).setName("API Key").setDesc("Your SovereignEG API key. Never share this key.").addText((text) => {
          text.inputEl.type = "password";
          text.setPlaceholder("sk-...").setValue(this.plugin.settings.apiKey).onChange(async (value) => {
            this.plugin.settings.apiKey = value.trim();
            await this.plugin.saveSettings();
          });
        });
        new obsidian2.Setting(containerEl).setName("Base URL").setDesc("The base URL for the OpenAI-compatible API").addText((text) => text.setPlaceholder("https://backend.sovereigneg.com/v1").setValue(this.plugin.settings.baseURL).onChange(async (value) => {
          this.plugin.settings.baseURL = value.trim().replace(/\/+$/, "");
          await this.plugin.saveSettings();
        }));
        new obsidian2.Setting(containerEl).setName("Model").setDesc("The model name to use for evaluations").addText((text) => text.setPlaceholder("kimi-k3").setValue(this.plugin.settings.model).onChange(async (value) => {
          this.plugin.settings.model = value.trim();
          await this.plugin.saveSettings();
        }));
        const transcriptionSection = containerEl.createEl("h3", { text: "Transcription (STT)" });
        transcriptionSection.style.marginTop = "var(--size-4-4)";
        new obsidian2.Setting(containerEl).setName("Transcription Base URL").setDesc("Full URL of the OpenAI-compatible audio transcriptions endpoint. Leave empty to use the main Base URL with /audio/transcriptions appended.").addText((text) => text.setPlaceholder("https://api.openai.com/v1/audio/transcriptions").setValue(this.plugin.settings.transcriptionBaseURL).onChange(async (value) => {
          this.plugin.settings.transcriptionBaseURL = value.trim();
          await this.plugin.saveSettings();
        }));
        new obsidian2.Setting(containerEl).setName("Transcription Model").setDesc("Model name to use for audio transcription (e.g., whisper-1).").addText((text) => text.setPlaceholder("whisper-1").setValue(this.plugin.settings.transcriptionModel).onChange(async (value) => {
          this.plugin.settings.transcriptionModel = value.trim();
          await this.plugin.saveSettings();
        }));
        new obsidian2.Setting(containerEl).setName("Transcription API Key").setDesc("Optional. API key for the transcription provider. Leave empty to use the main API key.").addText((text) => {
          text.inputEl.type = "password";
          text.setPlaceholder("sk-...").setValue(this.plugin.settings.transcriptionApiKey).onChange(async (value) => {
            this.plugin.settings.transcriptionApiKey = value.trim();
            await this.plugin.saveSettings();
          });
        });
      }
    };
    module2.exports = { AISpacedRepetitionSettingTab: AISpacedRepetitionSettingTab2 };
  }
});

// src/ai-service.js
var require_ai_service = __commonJS({
  "src/ai-service.js"(exports2, module2) {
    var obsidian2 = require("obsidian");
    var { VALID_VERDICTS, VALID_RATINGS } = require_constants();
    var AIService = class {
      constructor(settings) {
        this.settings = settings;
      }
      /**
       * Main entry: sends question + expected + user answer to AI,
       * then parses and validates the structured JSON response.
       */
      async evaluate(question, expectedAnswer, userAnswer) {
        const messages = this.buildMessages(question, expectedAnswer, userAnswer);
        const response = await this.makeRequest(messages);
        if (response.status < 200 || response.status >= 300) {
          throw new Error(this.extractError(response));
        }
        const data = response.json;
        if (!data || !data.choices || !data.choices[0] || !data.choices[0].message) {
          throw new Error("Invalid API response structure");
        }
        const content = data.choices[0].message.content;
        const parsed = this.parseJSON(content);
        this.validateEvaluation(parsed);
        return parsed;
      }
      /**
       * Builds the system + user messages for the chat completion.
       */
      buildMessages(question, expectedAnswer, userAnswer) {
        return [
          {
            role: "system",
            content: `You are an expert technical interviewer evaluating a candidate's answer to a technical flashcard question.

Evaluate the answer based on:
- Technical correctness
- Conceptual understanding
- Missing important concepts
- Incorrect technical statements
- Whether the answer is sufficient for an interview

Rules:
- Accept technically correct alternative explanations, terminology, and wording.
- Do NOT use exact text matching.
- Do NOT invent missing information or claim the user said something they did not say.

Respond ONLY with a valid JSON object matching this exact schema. Do not include markdown code blocks or extra text:
{
  "score": number (0-100),
  "verdict": string ("correct", "partially_correct", or "incorrect"),
  "technical_accuracy": string,
  "strengths": array of strings,
  "missing_concepts": array of strings,
  "mistakes": array of strings,
  "improved_answer": string,
  "interview_feedback": string,
  "suggested_rating": string ("Again", "Hard", "Good", or "Easy")
}`
          },
          {
            role: "user",
            content: `Question: ${question}

Expected Answer: ${expectedAnswer}

User's Answer: ${userAnswer}

Evaluate the user's answer fairly, accepting alternative correct explanations.`
          }
        ];
      }
      /**
       * Performs the actual HTTP POST via Obsidian's requestUrl.
       */
      async makeRequest(messages) {
        const url = `${this.settings.baseURL}/chat/completions`;
        const body = {
          model: this.settings.model,
          messages,
          temperature: 0.3
        };
        const headers = {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.settings.apiKey}`
        };
        try {
          return await obsidian2.requestUrl({
            url,
            method: "POST",
            headers,
            body: JSON.stringify(body)
          });
        } catch (networkError) {
          throw new Error(`Network error: ${networkError.message || networkError}`);
        }
      }
      /**
       * Extracts a readable error string from an API response.
       */
      extractError(response) {
        let msg = `HTTP ${response.status}`;
        if (response.json && response.json.error) {
          const err = response.json.error;
          msg += `: ${err.message || JSON.stringify(err)}`;
        } else if (response.text) {
          msg += `: ${response.text.substring(0, 200)}`;
        }
        if (response.status === 401) msg += " (check your API key)";
        if (response.status === 429) msg += " (rate limit exceeded)";
        return msg;
      }
      /**
       * Parses the raw AI response, stripping markdown fences if present.
       */
      parseJSON(content) {
        if (!content) throw new Error("Empty AI response content");
        let cleaned = content.trim();
        if (cleaned.startsWith("```")) {
          cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "").trim();
        }
        try {
          return JSON.parse(cleaned);
        } catch (e) {
          throw new Error(`Failed to parse AI response as JSON: ${e.message}`);
        }
      }
      /**
       * Validates the parsed evaluation object against the required schema.
       */
      validateEvaluation(evaluation) {
        if (!evaluation || typeof evaluation !== "object") {
          throw new Error("Evaluation is not a valid object");
        }
        const required = [
          "score",
          "verdict",
          "technical_accuracy",
          "strengths",
          "missing_concepts",
          "mistakes",
          "improved_answer",
          "interview_feedback",
          "suggested_rating"
        ];
        for (const field of required) {
          if (!(field in evaluation)) {
            throw new Error(`Missing required field: ${field}`);
          }
        }
        if (typeof evaluation.score !== "number" || evaluation.score < 0 || evaluation.score > 100) {
          throw new Error(`Invalid score: ${evaluation.score} (must be 0-100)`);
        }
        if (!VALID_VERDICTS.includes(evaluation.verdict)) {
          throw new Error(`Invalid verdict: ${evaluation.verdict}`);
        }
        if (!VALID_RATINGS.includes(evaluation.suggested_rating)) {
          throw new Error(`Invalid suggested_rating: ${evaluation.suggested_rating}`);
        }
        for (const arrField of ["strengths", "missing_concepts", "mistakes"]) {
          if (!Array.isArray(evaluation[arrField])) {
            throw new Error(`Field ${arrField} must be an array`);
          }
        }
        for (const strField of ["technical_accuracy", "improved_answer", "interview_feedback"]) {
          if (typeof evaluation[strField] !== "string") {
            throw new Error(`Field ${strField} must be a string`);
          }
        }
      }
    };
    module2.exports = { AIService };
  }
});

// src/utilities.js
var require_utilities = __commonJS({
  "src/utilities.js"(exports2, module2) {
    function formatDuration(ms) {
      const totalSeconds = Math.floor(ms / 1e3);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    }
    function formatBytes(bytes) {
      if (bytes === 0) return "0 B";
      const k = 1024;
      const sizes = ["B", "KB", "MB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
    }
    function capitalizeFirst(str) {
      if (!str) return "";
      return str.charAt(0).toUpperCase() + str.slice(1);
    }
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
    function compileSessionReport(question, expectedAnswer, userAnswer, audioBlob, recordingDurationMs, evaluationResult) {
      let text = `# Flashcard Session

## Question
${question}

## Your Answer
${userAnswer || "(no answer typed)"}
`;
      if (audioBlob && audioBlob.size > 0) {
        text += `
**Voice Recording:** Yes (${formatDuration(recordingDurationMs)}, ${formatBytes(audioBlob.size)})
`;
      } else {
        text += `
**Voice Recording:** None
`;
      }
      text += `
## Expected Answer
${expectedAnswer}
`;
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
${r.strengths.length > 0 ? r.strengths.map((s) => `- ${s}`).join("\n") : "_None listed_"}

### Missing Concepts
${r.missing_concepts.length > 0 ? r.missing_concepts.map((m) => `- ${m}`).join("\n") : "_None listed_"}

### Mistakes
${r.mistakes.length > 0 ? r.mistakes.map((m) => `- ${m}`).join("\n") : "_None listed_"}

### Improved Answer
${r.improved_answer}

### Interview Feedback
${r.interview_feedback}
`;
      } else {
        text += `
## AI Evaluation
_Not evaluated yet._
`;
      }
      return text;
    }
    module2.exports = {
      formatDuration,
      formatBytes,
      capitalizeFirst,
      detectSupportedMimeType,
      compileSessionReport
    };
  }
});

// src/audio-recorder.js
var require_audio_recorder = __commonJS({
  "src/audio-recorder.js"(exports2, module2) {
    var { detectSupportedMimeType } = require_utilities();
    var AudioRecorder = class {
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
          this.mediaRecorder.start(1e3);
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
    };
    module2.exports = { AudioRecorder };
  }
});

// src/evaluation-renderer.js
var require_evaluation_renderer = __commonJS({
  "src/evaluation-renderer.js"(exports2, module2) {
    var EvaluationRenderer = class {
      constructor(container) {
        this.container = container;
      }
      /**
       * Clears previous results and renders a full evaluation block.
       */
      render(result) {
        if (!this.container) return;
        const c = this.container;
        c.empty();
        c.style.display = "block";
        this.renderScoreAndVerdict(c, result);
        this.renderSection(c, "Technical Accuracy", result.technical_accuracy, "evaluation-technical-accuracy");
        if (result.strengths && result.strengths.length > 0) {
          this.renderList(c, "Strengths", result.strengths, "evaluation-strengths");
        }
        if (result.missing_concepts && result.missing_concepts.length > 0) {
          this.renderList(c, "Missing Concepts", result.missing_concepts, "evaluation-missing");
        }
        if (result.mistakes && result.mistakes.length > 0) {
          this.renderList(c, "Mistakes", result.mistakes, "evaluation-mistakes");
        }
        if (result.improved_answer) {
          this.renderSection(c, "Improved Answer", result.improved_answer, "evaluation-improved");
        }
        if (result.interview_feedback) {
          this.renderSection(c, "Interview Feedback", result.interview_feedback, "evaluation-feedback");
        }
        this.renderRating(c, result.suggested_rating);
      }
      renderScoreAndVerdict(container, result) {
        const scoreSec = container.createEl("div", { cls: "evaluation-score-section" });
        scoreSec.createEl("div", {
          text: `${result.score}`,
          cls: `evaluation-score ${this.scoreClass(result.score)}`
        });
        scoreSec.createEl("div", {
          text: this.capitalizeFirst(result.verdict.replace(/_/g, " ")),
          cls: `evaluation-verdict verdict-${result.verdict}`
        });
      }
      renderSection(container, title, content, cls) {
        const sec = container.createEl("div", { cls: `evaluation-section ${cls}` });
        sec.createEl("h4", { text: title, cls: "evaluation-section-title" });
        sec.createEl("div", { text: content, cls: "evaluation-section-content" });
      }
      renderList(container, title, items, cls) {
        const sec = container.createEl("div", { cls: `evaluation-section ${cls}` });
        sec.createEl("h4", { text: title, cls: "evaluation-section-title" });
        const list = sec.createEl("ul", { cls: "evaluation-list" });
        for (const item of items) {
          list.createEl("li", { text: item, cls: "evaluation-list-item" });
        }
      }
      renderRating(container, rating) {
        const ratingSec = container.createEl("div", { cls: "evaluation-rating-section" });
        ratingSec.createEl("h4", { text: "Suggested Rating", cls: "evaluation-rating-title" });
        ratingSec.createEl("span", {
          text: rating,
          cls: `evaluation-rating rating-${rating.toLowerCase()}`
        });
      }
      scoreClass(score) {
        if (score >= 80) return "score-excellent";
        if (score >= 60) return "score-good";
        if (score >= 40) return "score-fair";
        return "score-poor";
      }
      capitalizeFirst(str) {
        if (!str) return "";
        return str.charAt(0).toUpperCase() + str.slice(1);
      }
    };
    module2.exports = { EvaluationRenderer };
  }
});

// src/services/TranscriptionService.js
var require_TranscriptionService = __commonJS({
  "src/services/TranscriptionService.js"(exports2, module2) {
    var obsidian2 = require("obsidian");
    var MAX_TRANSCRIPTION_SIZE_BYTES = 25 * 1024 * 1024;
    var TRANSCRIPTION_TIMEOUT_MS = 3e4;
    var MIME_TYPE_TO_EXTENSION = {
      "audio/webm": "webm",
      "audio/webm;codecs=opus": "webm",
      "audio/mp4": "m4a",
      "audio/ogg": "ogg",
      "audio/ogg;codecs=opus": "ogg",
      "audio/mp3": "mp3",
      "audio/mpeg": "mp3",
      "audio/wav": "wav"
    };
    var TranscriptionService = class {
      constructor(settings) {
        this.settings = settings;
      }
      /**
       * Sends an audio Blob to the configured transcription endpoint and returns
       * the recognized text.
       *
       * @param {Blob} audioBlob - The recorded audio data.
       * @param {string} mimeType - The MIME type of the recorded audio.
       * @returns {Promise<string>} The transcribed text.
       */
      async transcribe(audioBlob, mimeType) {
        if (!audioBlob || !(audioBlob instanceof Blob) || audioBlob.size === 0) {
          throw new TranscriptionError("No audio recording available.", "missing_audio");
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
        const preamble = `--${boundary}\r
Content-Disposition: form-data; name="model"\r
\r
${model}\r
--${boundary}\r
Content-Disposition: form-data; name="file"; filename="${filename}"\r
Content-Type: ${contentType}\r
\r
`;
        const postamble = `\r
--${boundary}--\r
`;
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
        const requestPromise = obsidian2.requestUrl({
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
    };
    var TranscriptionError = class extends Error {
      constructor(message, code) {
        super(message);
        this.name = "TranscriptionError";
        this.code = code;
      }
    };
    module2.exports = { TranscriptionService, TranscriptionError, MAX_TRANSCRIPTION_SIZE_BYTES };
  }
});

// src/flashcard-modal.js
var require_flashcard_modal = __commonJS({
  "src/flashcard-modal.js"(exports2, module2) {
    var obsidian2 = require("obsidian");
    var { AIService } = require_ai_service();
    var { AudioRecorder } = require_audio_recorder();
    var { EvaluationRenderer } = require_evaluation_renderer();
    var { TranscriptionService } = require_TranscriptionService();
    var { formatDuration, formatBytes, compileSessionReport } = require_utilities();
    var FlashcardReviewModal2 = class extends obsidian2.Modal {
      constructor(app, settings) {
        super(app);
        this.settings = settings;
        this.aiService = new AIService(settings);
        this.audioRecorder = new AudioRecorder();
        this.transcriptionService = new TranscriptionService(settings);
        this.evaluationRenderer = null;
        this.question = "What is the difference between Kubernetes Deployment and StatefulSet?";
        this.expectedAnswer = "A Deployment manages stateless applications using ReplicaSets, while a StatefulSet manages stateful applications and provides stable network identities and persistent storage associations.";
        this.isAnswerRevealed = false;
        this.userAnswer = "";
        this.isEvaluating = false;
        this.evaluationResult = null;
        this.isTranscribing = false;
        this.transcribedText = "";
        this._dom = {};
      }
      // ═══════════════════════════════════════════════════════════
      // Lifecycle
      // ═══════════════════════════════════════════════════════════
      onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.classList.add("ai-spaced-repetition-modal");
        this.renderQuestionSection(contentEl);
        this.renderTextAnswerSection(contentEl);
        this.renderVoiceAnswerSection(contentEl);
        this.renderExpectedAnswerSection(contentEl);
        this.renderEvaluationSection(contentEl);
        this.renderActionButtons(contentEl);
      }
      onClose() {
        this.audioRecorder.cleanup();
        const { contentEl } = this;
        contentEl.empty();
      }
      // ═══════════════════════════════════════════════════════════
      // Rendering helpers
      // ═══════════════════════════════════════════════════════════
      renderQuestionSection(container) {
        const sec = container.createEl("div", { cls: "flashcard-question-section" });
        sec.createEl("h2", { text: "Question", cls: "flashcard-section-title" });
        sec.createEl("p", { text: this.question, cls: "flashcard-question-text" });
      }
      renderTextAnswerSection(container) {
        const sec = container.createEl("div", { cls: "flashcard-user-answer-section" });
        sec.createEl("h3", { text: "Your Answer", cls: "flashcard-section-subtitle" });
        this._dom.userAnswerTextarea = sec.createEl("textarea", { cls: "flashcard-textarea" });
        this._dom.userAnswerTextarea.setAttribute("rows", "6");
        this._dom.userAnswerTextarea.setAttribute("placeholder", "Type your answer here...");
        this._dom.userAnswerTextarea.value = this.userAnswer;
        this._dom.userAnswerTextarea.addEventListener("input", (event) => {
          this.userAnswer = event.target.value;
          this.showValidation("");
        });
        this._dom.validationEl = sec.createEl("div", { cls: "flashcard-validation-message" });
        this._dom.validationEl.style.display = "none";
      }
      renderVoiceAnswerSection(container) {
        const sec = container.createEl("div", { cls: "flashcard-voice-answer-section" });
        sec.createEl("h3", { text: "Voice Answer", cls: "flashcard-section-subtitle" });
        this._dom.transcriptionContainer = sec.createEl("div", { cls: "transcription-container" });
        this._dom.transcriptionContainer.style.display = "none";
        this._dom.transcriptionContainer.createEl("h4", {
          text: "Transcription",
          cls: "transcription-title"
        });
        this._dom.transcriptionTextarea = this._dom.transcriptionContainer.createEl("textarea", {
          cls: "flashcard-textarea transcription-textarea"
        });
        this._dom.transcriptionTextarea.setAttribute("rows", "6");
        this._dom.transcriptionTextarea.setAttribute("placeholder", "Transcribed text will appear here...");
        this._dom.transcriptionTextarea.addEventListener("input", (event) => {
          this.transcribedText = event.target.value;
        });
        const evaluateBtn = this._dom.transcriptionContainer.createEl("button", {
          text: "Evaluate Transcript",
          cls: "mod-cta evaluate-transcript-btn"
        });
        evaluateBtn.addEventListener("click", () => this.handleEvaluateTranscript());
        this._dom.transcriptionIndicator = sec.createEl("div", { cls: "transcription-indicator" });
        this._dom.transcriptionIndicator.style.display = "none";
        this._dom.transcriptionIndicator.createEl("span", { cls: "transcription-spinner" });
        this._dom.transcriptionIndicator.createEl("span", { text: " Transcribing...", cls: "transcription-label" });
        this._dom.recordingIndicator = sec.createEl("div", { cls: "recording-indicator" });
        this._dom.recordingIndicator.style.display = "none";
        this._dom.recordingIndicator.createEl("span", { cls: "recording-dot" });
        this._dom.recordingIndicator.createEl("span", { text: " Recording", cls: "recording-label" });
        this._dom.recordingTimer = this._dom.recordingIndicator.createEl("span", { cls: "recording-timer" });
        const recControls = sec.createEl("div", { cls: "recording-controls" });
        this._dom.startRecordBtn = recControls.createEl("button", {
          text: "Start Recording",
          cls: "mod-cta voice-record-start-btn"
        });
        this._dom.startRecordBtn.addEventListener("click", () => this.handleStartRecording());
        this._dom.stopRecordBtn = recControls.createEl("button", {
          text: "Stop Recording",
          cls: "voice-record-stop-btn"
        });
        this._dom.stopRecordBtn.style.display = "none";
        this._dom.stopRecordBtn.addEventListener("click", () => this.handleStopRecording());
        this._dom.playbackControls = sec.createEl("div", { cls: "playback-controls" });
        this._dom.playbackControls.style.display = "none";
        this._dom.audioPlayer = this._dom.playbackControls.createEl("audio", { cls: "voice-audio-player" });
        this._dom.audioPlayer.setAttribute("controls", "");
        const pbButtons = this._dom.playbackControls.createEl("div", { cls: "playback-buttons" });
        pbButtons.createEl("button", { text: "Delete", cls: "voice-delete-btn" }).addEventListener("click", () => this.handleDeleteRecording());
        pbButtons.createEl("button", { text: "Record Again", cls: "voice-record-again-btn" }).addEventListener("click", () => this.handleRecordAgain());
        pbButtons.createEl("button", { text: "Submit Recording", cls: "mod-cta voice-submit-btn" }).addEventListener("click", () => this.handleSubmitRecording());
        this._dom.audioValidationEl = sec.createEl("div", { cls: "flashcard-validation-message" });
        this._dom.audioValidationEl.style.display = "none";
      }
      renderExpectedAnswerSection(container) {
        this._dom.expectedAnswerContainer = container.createEl("div", {
          cls: "flashcard-expected-answer-content"
        });
        this._dom.expectedAnswerContainer.style.display = "none";
        this._dom.expectedAnswerContainer.createEl("h3", {
          text: "Expected Answer",
          cls: "flashcard-section-subtitle"
        });
        this._dom.expectedAnswerContainer.createEl("div", {
          text: this.expectedAnswer,
          cls: "flashcard-expected-answer-text"
        });
      }
      renderEvaluationSection(container) {
        this._dom.evaluationResultsContainer = container.createEl("div", {
          cls: "evaluation-results-container"
        });
        this._dom.evaluationResultsContainer.style.display = "none";
        this.evaluationRenderer = new EvaluationRenderer(this._dom.evaluationResultsContainer);
      }
      renderActionButtons(container) {
        const sec = container.createEl("div", { cls: "flashcard-button-section" });
        this._dom.revealBtn = sec.createEl("button", {
          text: "Reveal Expected Answer",
          cls: "mod-cta flashcard-reveal-button"
        });
        this._dom.revealBtn.addEventListener("click", () => this.toggleExpectedAnswer());
        this._dom.evaluateBtn = sec.createEl("button", {
          text: "Evaluate Answer",
          cls: "mod-cta flashcard-evaluate-button"
        });
        this._dom.evaluateBtn.addEventListener("click", () => this.handleEvaluateAnswer());
        sec.createEl("button", { text: "Copy Session", cls: "flashcard-copy-button" }).addEventListener("click", () => this.copySessionToClipboard());
        sec.createEl("button", { text: "Close", cls: "flashcard-close-button" }).addEventListener("click", () => this.close());
      }
      // ═══════════════════════════════════════════════════════════
      // Expected answer reveal / hide
      // ═══════════════════════════════════════════════════════════
      toggleExpectedAnswer() {
        this.isAnswerRevealed = !this.isAnswerRevealed;
        if (this.isAnswerRevealed) {
          this._dom.expectedAnswerContainer.style.display = "block";
          this._dom.revealBtn.textContent = "Hide Expected Answer";
        } else {
          this._dom.expectedAnswerContainer.style.display = "none";
          this._dom.revealBtn.textContent = "Reveal Expected Answer";
        }
      }
      // ═══════════════════════════════════════════════════════════
      // Validation helpers
      // ═══════════════════════════════════════════════════════════
      showValidation(message) {
        if (!this._dom.validationEl) return;
        if (message) {
          this._dom.validationEl.textContent = message;
          this._dom.validationEl.style.display = "block";
        } else {
          this._dom.validationEl.textContent = "";
          this._dom.validationEl.style.display = "none";
        }
      }
      showAudioValidation(message) {
        if (!this._dom.audioValidationEl) return;
        if (message) {
          this._dom.audioValidationEl.textContent = message;
          this._dom.audioValidationEl.style.display = "block";
        } else {
          this._dom.audioValidationEl.textContent = "";
          this._dom.audioValidationEl.style.display = "none";
        }
      }
      // ═══════════════════════════════════════════════════════════
      // Evaluate text answer
      // ═══════════════════════════════════════════════════════════
      async handleEvaluateAnswer() {
        const currentAnswer = this._dom.userAnswerTextarea.value.trim();
        this.userAnswer = currentAnswer;
        if (!currentAnswer) {
          this.showValidation("Please provide an answer before evaluating.");
          this._dom.userAnswerTextarea.focus();
          return;
        }
        if (!this.settings.apiKey) {
          new obsidian2.Notice("API key not configured. Go to Settings \u2192 AI Spaced Repetition to add your key.");
          return;
        }
        if (this.isEvaluating) return;
        this.isEvaluating = true;
        this.showValidation("");
        this.setEvaluateButtonState("loading");
        try {
          const result = await this.aiService.evaluate(this.question, this.expectedAnswer, currentAnswer);
          this.evaluationResult = result;
          this.evaluationRenderer.render(result);
          this.setEvaluateButtonState("reevaluate");
        } catch (error) {
          console.error("AI Evaluation error:", error);
          this.showValidation(`Evaluation failed: ${error.message}`);
          this.setEvaluateButtonState(this.evaluationResult ? "reevaluate" : "idle");
        } finally {
          this.isEvaluating = false;
        }
      }
      setEvaluateButtonState(state) {
        if (!this._dom.evaluateBtn) return;
        const btn = this._dom.evaluateBtn;
        btn.disabled = false;
        btn.classList.remove("is-loading");
        if (state === "loading") {
          btn.textContent = "Evaluating...";
          btn.disabled = true;
          btn.classList.add("is-loading");
        } else if (state === "reevaluate") {
          btn.textContent = "Re-evaluate Answer";
        } else {
          btn.textContent = "Evaluate Answer";
        }
      }
      // ═══════════════════════════════════════════════════════════
      // Voice recording handlers
      // ═══════════════════════════════════════════════════════════
      async handleStartRecording() {
        if (this.audioRecorder.isRecording) return;
        this.showAudioValidation("");
        try {
          await this.audioRecorder.start(
            null,
            // onDataAvailable — not needed for UI
            (blob, mimeType, url) => {
              this._dom.audioPlayer.src = url;
              this.setVoiceUIState("playback");
            },
            (error) => {
              this.showAudioValidation(error.message);
              this.setVoiceUIState("idle");
            },
            (durationMs) => {
              this._dom.recordingTimer.textContent = ` (${formatDuration(durationMs)})`;
            }
          );
          this.setVoiceUIState("recording");
        } catch (error) {
          this.showAudioValidation(error.message);
          this.setVoiceUIState("idle");
        }
      }
      handleStopRecording() {
        this.audioRecorder.stop();
        this.setVoiceUIState("stopped");
      }
      handleDeleteRecording() {
        this.audioRecorder.delete();
        this._dom.audioPlayer.src = "";
        this.setVoiceUIState("idle");
        this.showAudioValidation("");
        this.hideTranscription();
      }
      handleRecordAgain() {
        this.handleDeleteRecording();
        this.handleStartRecording();
      }
      async handleSubmitRecording() {
        const recorder = this.audioRecorder;
        if (!recorder.audioBlob || recorder.audioBlob.size === 0) {
          this.showAudioValidation("No valid recording to submit. Please record first.");
          return;
        }
        if (!this.settings.apiKey) {
          new obsidian2.Notice("API key not configured. Go to Settings \u2192 AI Spaced Repetition to add your key.");
          return;
        }
        if (this.isTranscribing) return;
        this.isTranscribing = true;
        this.showAudioValidation("");
        this.setTranscriptionState("loading");
        try {
          const mimeType = recorder.audioBlob.type || "audio/webm";
          const transcript = await this.transcriptionService.transcribe(recorder.audioBlob, mimeType);
          this.transcribedText = transcript;
          this._dom.transcriptionTextarea.value = transcript;
          this.setTranscriptionState("ready");
          new obsidian2.Notice("Transcription complete. Review and edit, then click Evaluate Transcript.");
        } catch (error) {
          console.error("Transcription error:", error);
          this.showAudioValidation(`Transcription failed: ${error.message}`);
          this.setTranscriptionState("hidden");
        } finally {
          this.isTranscribing = false;
        }
      }
      async handleEvaluateTranscript() {
        const transcript = this._dom.transcriptionTextarea.value.trim();
        this.transcribedText = transcript;
        if (!transcript) {
          this.showAudioValidation("Please review the transcription before evaluating.");
          this._dom.transcriptionTextarea.focus();
          return;
        }
        if (this.isEvaluating) return;
        this.isEvaluating = true;
        this.showAudioValidation("");
        this.setEvaluateButtonState("loading");
        try {
          const result = await this.aiService.evaluate(this.question, this.expectedAnswer, transcript);
          this.evaluationResult = result;
          this.evaluationRenderer.render(result);
          this.setEvaluateButtonState("reevaluate");
        } catch (error) {
          console.error("AI Evaluation error:", error);
          this.showAudioValidation(`Evaluation failed: ${error.message}`);
          this.setEvaluateButtonState(this.evaluationResult ? "reevaluate" : "idle");
        } finally {
          this.isEvaluating = false;
        }
      }
      hideTranscription() {
        this.transcribedText = "";
        if (this._dom.transcriptionContainer) {
          this._dom.transcriptionContainer.style.display = "none";
        }
        if (this._dom.transcriptionTextarea) {
          this._dom.transcriptionTextarea.value = "";
        }
      }
      setTranscriptionState(state) {
        const container = this._dom.transcriptionContainer;
        const indicator = this._dom.transcriptionIndicator;
        if (!container || !indicator) return;
        if (state === "loading") {
          container.style.display = "none";
          indicator.style.display = "flex";
        } else if (state === "ready") {
          indicator.style.display = "none";
          container.style.display = "block";
        } else {
          indicator.style.display = "none";
          container.style.display = "none";
        }
      }
      // ═══════════════════════════════════════════════════════════
      // Voice UI state machine
      // ═══════════════════════════════════════════════════════════
      setVoiceUIState(state) {
        const {
          recordingIndicator,
          startRecordBtn,
          stopRecordBtn,
          playbackControls,
          transcriptionContainer,
          transcriptionIndicator
        } = this._dom;
        if (!recordingIndicator || !startRecordBtn || !stopRecordBtn || !playbackControls) return;
        if (state === "recording") {
          recordingIndicator.style.display = "flex";
          startRecordBtn.style.display = "none";
          stopRecordBtn.style.display = "inline-block";
          playbackControls.style.display = "none";
          if (transcriptionContainer) transcriptionContainer.style.display = "none";
          if (transcriptionIndicator) transcriptionIndicator.style.display = "none";
          this._dom.recordingTimer.textContent = " (00:00)";
        } else if (state === "stopped") {
          recordingIndicator.style.display = "none";
          startRecordBtn.style.display = "inline-block";
          stopRecordBtn.style.display = "none";
          playbackControls.style.display = "none";
          if (transcriptionIndicator) transcriptionIndicator.style.display = "none";
        } else if (state === "playback") {
          recordingIndicator.style.display = "none";
          startRecordBtn.style.display = "none";
          stopRecordBtn.style.display = "none";
          playbackControls.style.display = "block";
          if (transcriptionIndicator) transcriptionIndicator.style.display = "none";
        } else {
          recordingIndicator.style.display = "none";
          startRecordBtn.style.display = "inline-block";
          stopRecordBtn.style.display = "none";
          playbackControls.style.display = "none";
          this._dom.recordingTimer.textContent = "";
        }
      }
      // ═══════════════════════════════════════════════════════════
      // Copy session
      // ═══════════════════════════════════════════════════════════
      copySessionToClipboard() {
        const userAnswer = this._dom.userAnswerTextarea ? this._dom.userAnswerTextarea.value.trim() : this.userAnswer;
        const report = compileSessionReport(
          this.question,
          this.expectedAnswer,
          userAnswer,
          this.audioRecorder.audioBlob,
          this.audioRecorder.recordingDurationMs,
          this.evaluationResult
        );
        navigator.clipboard.writeText(report).then(() => {
          new obsidian2.Notice("Session copied to clipboard!");
        }).catch((err) => {
          console.error("Failed to copy:", err);
          new obsidian2.Notice("Failed to copy session. Check browser permissions.");
        });
      }
    };
    module2.exports = { FlashcardReviewModal: FlashcardReviewModal2 };
  }
});

// main-source.js
var obsidian = require("obsidian");
var { DEFAULT_SETTINGS } = require_constants();
var { AISpacedRepetitionSettingTab } = require_settings_tab();
var { FlashcardReviewModal } = require_flashcard_modal();
var AISpacedRepetition = class extends obsidian.Plugin {
  async onload() {
    console.log("AI Spaced Repetition: Plugin loaded");
    await this.loadSettings();
    this.addCommand({
      id: "open-ai-review",
      name: "Open AI Review",
      callback: () => {
        new FlashcardReviewModal(this.app, this.settings).open();
      }
    });
    this.addSettingTab(new AISpacedRepetitionSettingTab(this.app, this));
    new obsidian.Notice("AI Spaced Repetition loaded!");
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  onunload() {
    console.log("AI Spaced Repetition: Plugin unloaded");
  }
};
module.exports = AISpacedRepetition;
