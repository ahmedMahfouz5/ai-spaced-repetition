# AI Spaced Repetition Plugin for Obsidian

> **Version:** 0.0.1  
> **Author:** Ahmed Mahfouz  
> **Platform:** Obsidian Desktop (Community Plugin)

An Obsidian community plugin that combines flashcard-based learning with AI-powered answer evaluation to create an intelligent, adaptive spaced repetition system — all inside your personal knowledge base.

---

## Table of Contents

1. [Overview](#overview)
2. [Milestones](#milestones)
3. [Milestone 1: Flashcard Review Interface](#milestone-1-flashcard-review-interface)
4. [Milestone 3: AI-Powered Answer Evaluation](#milestone-3-ai-powered-answer-evaluation)
5. [Installation](#installation)
6. [Usage](#usage)
7. [API Configuration](#api-configuration)
8. [Project Structure](#project-structure)
9. [Technology Stack](#technology-stack)
10. [Testing Scenarios](#testing-scenarios)
11. [Future Roadmap](#future-roadmap)
12. [License](#license)

---

## Overview

**AI Spaced Repetition** is an Obsidian plugin designed to enhance learning workflows by:

- Extracting flashcards from your Obsidian notes using custom syntax *(Milestone 2)*
- Presenting them in a clean, native review interface *(Milestone 1)*
- Evaluating your answers using AI *(Milestone 3)*
- Scheduling reviews using a spaced repetition algorithm *(future milestone)*
- Tracking your learning progress and statistics *(future milestone)*

Instead of exporting your notes to external SRS apps like Anki, this plugin keeps your learning process inside Obsidian — where your notes already live.

---

## Milestones

| Milestone | Status | Description |
|-----------|--------|-------------|
| **Milestone 0** | :white_check_mark: Complete | Plugin scaffolding with "Open AI Review" command and welcome modal |
| **Milestone 1** | :white_check_mark: Complete | Functional flashcard review interface with hardcoded data |
| **Milestone 2** | :hourglass: Planned | Flashcard parsing from Obsidian notes |
| **Milestone 3** | :white_check_mark: Complete | AI API integration for answer evaluation |
| **Milestone 4** | :hourglass: Planned | Spaced repetition scheduling (SM-2/FSRS) |
| **Milestone 5** | :hourglass: Planned | Learning statistics and progress dashboard |
| **Milestone 6** | :hourglass: Planned | Speech-to-text for answer input |
| **Milestone 7** | :hourglass: Planned | Multi-language and English assessment support |

---

## Milestone 1: Flashcard Review Interface

**Status:** :white_check_mark: Complete  
### What Was Implemented

A functional flashcard review modal with:
- Hardcoded test flashcard (Kubernetes Deployment vs StatefulSet)
- Question display with a highlighted banner
- Multiline textarea for user answers
- Reveal/hide toggle for the expected answer without clearing user input
- Inline validation for empty answers
- "Evaluate Answer" button (placeholder for AI — now implemented in Milestone 3)
---

## Milestone 3: AI-Powered Answer Evaluation

**Status:** :white_check_mark: Complete
### Objective

When the user clicks "Evaluate Answer", send the question, expected answer, and user's submitted answer to an AI API. The AI evaluates:
- Technical correctness
- Conceptual understanding
- Missing important concepts
- Incorrect technical statements
- Whether the answer is sufficient for an interview

The AI accepts technically correct alternative explanations, terminology, and wording — no exact text matching.

### AI Evaluation Engine

#### System Prompt
The AI receives a detailed system prompt instructing it to:
- Act as an expert technical interviewer
- Accept alternative correct wording and synonyms
- Not use exact text matching
- Not invent missing information or hallucinate claims about the user's answer
- Respond **only** with a valid JSON object (no markdown, no explanatory text)

#### Input Format


## Project Structure

