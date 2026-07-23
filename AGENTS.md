# Siddur app

## Goal:
The goal is to build an Android/Ionic app, that contains a PDF Siddur theilat hashem (Chabbad) siddur for prayers.
The initial logic will have a few presets, and displaying tham in the app (e.g. Morning prayer - שחרית from page 5 - 64 and so on).
It should support both Android & IOS & PWA.

## Tech stack:
Angualr, Material Design, Ionic
Use as much as Material design styles/Componenet.
If custom CSS styles are needed, add tham as generic class in main style sheet for later re-use (e.g. .flex-row, .mb-5, .text-center and so on)

## Rules, Conventions:
Use modern angular:
 - @if, @for
 - Standalone components
Position different domains in own directory (e.g. Services, Models, Componenets, States directory).

## Instructions:
- Do not override manual changes! If you see something has changed since last iteration, do not change unless explicitly asked to.
- Text sources live in `src/assets/siddur/source/*.txt`.
- Text source syntax:
  - `# [section-id] Title` starts a document section.
  - `##` through `#####` are heading levels.
  - Plain non-empty lines are paragraph blocks.
  - Lines starting with `>` are notes/comments.
  - Blank lines are ignored and just separate blocks for readability.
  - `@if rule` and `@endif` wrap conditional blocks.
  - `@small` and `@endsmall` wrap inline text that continues the surrounding paragraph in a smaller font.
