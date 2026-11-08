# AI Spaced Repetition Plugin for Obsidian

> **Version:** 0.0.1  
> **Author:** Ahmed Mahfouz  
> **Platform:** Obsidian Desktop (Community Plugin)

An Obsidian community plugin that combines flashcard-based learning with AI-powered answer evaluation to create an intelligent, adaptive spaced repetition system — all inside your personal knowledge base.

---

## Table of Contents

1. [Overview](#overview)
2. [Milestones](#milestones)
3. [Current Milestone: Flashcard Review Interface](#milestone-1-flashcard-review-interface)
4. [Installation](#installation)
5. [Usage](#usage)
6. [Project Structure](#project-structure)
7. [Technology Stack](#technology-stack)
8. [Future Roadmap](#future-roadmap)
9. [License](#license)

---

## Overview

**AI Spaced Repetition** is an Obsidian plugin designed to enhance learning workflows by:

- Extracting flashcards from your Obsidian notes using custom syntax
- Presenting them in a clean, native review interface
- Evaluating your answers using AI (future milestone)
- Scheduling reviews using a spaced repetition algorithm (future milestone)
- Tracking your learning progress and statistics (future milestone)

Instead of exporting your notes to external SRS apps like Anki, this plugin keeps your learning process inside Obsidian — where your notes already live.

---

## Milestones

| Milestone | Status | Description |
|-----------|--------|-------------|
| **Milestone 0** | :white_check_mark: Complete | Plugin scaffolding with "Open AI Review" command and welcome modal |
| **Milestone 1** | :white_check_mark: Complete | Functional flashcard review interface with hardcoded data |
| **Milestone 2** | :hourglass: Planned | Flashcard parsing from Obsidian notes |
| **Milestone 3** | :hourglass: Planned | AI API integration for answer evaluation |
| **Milestone 4** | :hourglass: Planned | Spaced repetition scheduling (SM-2/FSRS) |
| **Milestone 5** | :hourglass: Planned | Learning statistics and progress dashboard |
| **Milestone 6** | :hourglass: Planned | Speech-to-text for answer input |
| **Milestone 7** | :hourglass: Planned | Multi-language and English assessment support |

---

## Milestone 1: Flashcard Review Interface

**Status:** :white_check_mark: Complete  
**Delivered in:** `v0.0.1`

### Objective

Replace the initial welcome modal with a functional flashcard review interface that allows users to:
- Read a flashcard question
- Write their own answer
- Reveal and compare against the expected answer
- Request evaluation (placeholder for future AI integration)

### What Was Implemented

#### Flashcard Data
A single hardcoded test flashcard is embedded for this milestone:

| Field | Content |
|-------|---------|
| **Question** | What is the difference between Kubernetes Deployment and StatefulSet? |
| **Expected Answer** | A Deployment manages stateless applications using ReplicaSets, while a StatefulSet manages stateful applications and provides stable network identities and persistent storage associations. |

#### User Interface Workflow

**Step 1: Display Question**
- The question is displayed prominently with a highlighted banner
- The expected answer is initially hidden
- A textarea is provided for multiline user input
- Action buttons: *Reveal Expected Answer*, *Evaluate Answer*, *Close*

**Step 2: Reveal Expected Answer**
- Clicking **Reveal Expected Answer** displays the expected answer with a smooth fade-in animation
- The button label changes to **Hide Expected Answer**
- Clicking again hides the answer without clearing the user's input
- User answer is always preserved during toggle interactions

**Step 3: User Answer Input**
- Multiline textarea supporting longer, detailed responses
- Inline validation prevents evaluation if the answer is empty
- Meaningful validation message: *"Please provide an answer before evaluating."*
- Validation message is cleared automatically on input

**Step 4: Evaluate Answer**
- Validates that the user answer is not empty
- Displays a temporary notice: *"Answer evaluation will be implemented in a future milestone."*
- No API calls are made
- No fake evaluation results are generated

### Technical Implementation

#### Code Architecture
- **`FlashcardReviewModal`** — Custom Obsidian Modal class managing the review lifecycle
- Separated rendering methods:
  - `renderQuestionSection(container)`
  - `renderUserAnswerSection(container)`
  - `renderExpectedAnswerSection(container)`
  - `renderActionButtons(container)`
- State tracking via class properties:
  - `isAnswerRevealed` — tracks visibility of expected answer
  - `userAnswer` — preserves textarea content across UI interactions
- DOM references cached for efficient updates:
  - `expectedAnswerContainer`
  - `userAnswerTextarea`
  - `revealButton`
  - `validationElement`

#### UI Requirements
- Uses Obsidian's native CSS variables (`--text-normal`, `--interactive-accent`, `--background-primary-alt`, etc.)
- Supports both dark and light themes automatically
- Clean, native Obsidian look with proper spacing and typography
- Responsive layout: buttons stack vertically on narrow viewports
- Styles defined in `styles.css` — no inline styling

#### Code Quality
- Obsidian plugin development conventions followed
- Clear, descriptive class and method names
- No global variables
- Modal content is properly cleaned up on close (`onClose()` calls `contentEl.empty()`)
- Empty input handled with validation
- Existing plugin initialization preserved

### What Was NOT Implemented

Per milestone scope restrictions, the following were explicitly deferred:

- :no_entry: AI API integration
- :no_entry: Flashcard parsing from notes
- :no_entry: Speech-to-text recognition
- :no_entry: English assessment / multi-language
- :no_entry: Spaced repetition scheduling
- :no_entry: Review intervals / FSRS / SM-2
- :no_entry: Learning statistics / progress tracking

---

## Installation

### Manual Installation (Developer / Testing)

1. Clone or copy this repository into your Obsidian vault:
   ```
   .obsidian/plugins/ai-spaced-repetition/
   ```
2. Ensure the following files are present:
   - `main.js`
   - `styles.css`
   - `manifest.json`
3. Restart Obsidian or reload plugins via Command Palette: **"Reload app without saving"**
4. Open **Settings > Community Plugins**
5. Enable **AI Spaced Repetition**

### Requirements

- Obsidian v1.5.0 or later (desktop only)
- Community plugins must be enabled in Obsidian settings

---

## Usage

### Opening the Review Interface

1. Open the **Command Palette** (`Ctrl+P` on Windows/Linux, `Cmd+P` on macOS)
2. Type and select **"Open AI Review"**
3. The flashcard review modal will open

### Review Workflow

1. **Read the question** displayed in the highlighted section
2. **Type your answer** in the textarea below
3. *(Optional)* Click **Reveal Expected Answer** to compare your knowledge
4. Click **Evaluate Answer** to submit (evaluation coming in Milestone 3)
5. Click **Close** when finished

---

## Project Structure

```
ai-spaced-repetition/
├── main.js           # Plugin entry point + FlashcardReviewModal logic
├── styles.css        # Theme-aware styling using Obsidian CSS variables
├── manifest.json     # Plugin metadata (Obsidian manifest)
├── package.json      # Node.js dependencies (obsidian API)
├── package-lock.json # Locked dependency versions
└── README.md         # This file
```

### File Responsibilities

| File | Responsibility |
|------|---------------|
| `main.js` | Plugin class, command registration, modal implementation, state management, DOM rendering, event handling |
| `styles.css` | Dark/light theme support, spacing, typography, responsive layout, animations |
| `manifest.json` | Plugin ID, name, version, min Obsidian version, author info |

---

## Technology Stack

| Technology | Purpose |
|------------|---------|
| JavaScript (ES6) | Plugin runtime logic |
| Obsidian API | Modal system, DOM utilities, command palette, notices |
| CSS3 | Variable-based theming, responsive design, animations |

**Explicitly NOT used in this milestone:**
- TypeScript (requested to defer)
- External AI APIs (future milestone)
- Flashcard parser (future milestone)
- Test frameworks (future consideration)
- Build tools / bundlers (keep it simple)

---

## Future Roadmap

### Milestone 2: Flashcard Parsing
- Define parsing syntax (e.g., `#flashcard` tag, `Q::A` format, or custom code blocks)
- Extract flashcards from active note or vault-wide
- Filter and load cards into review queue

### Milestone 3: AI Answer Evaluation
- Integrate with external LLM API (e.g., OpenAI, Anthropic, local Ollama)
- Send user's answer + expected answer to AI model
- Receive structured feedback:
  - Accuracy score
  - Missing key points
  - Improvement suggestions
  - Encouraging feedback

### Milestone 4: Spaced Repetition Scheduling
- Implement SM-2 algorithm or FSRS (Free Spaced Repetition Scheduler)
- Persist review intervals and card metadata
- Track ease factors, repetition counts, and due dates
- Generate daily review queues

### Milestone 5: Statistics & Dashboard
- Cards reviewed per day/week/month
- Accuracy trends over time
- Topics / tags performance breakdown
- Streak tracking
- Next review preview

### Milestone 6: Voice Input
- Speech-to-text for hands-free answer input
- Browser / OS speech recognition APIs

### Milestone 7: Multi-Language Support
- Support for non-English flashcard content
- AI evaluation in multiple languages
- English proficiency assessment features

---

## License

MIT License — free for personal and commercial use.

---

> *"Build once, learn forever — inside your second brain."*
