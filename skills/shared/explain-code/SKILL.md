---
name: explain-code
description: Explains what a file, function, or snippet does in plain British English without changing any files. Use when the user asks what some code does or how it works.
---
# Explain Code

## Objective
Give a short, accurate explanation of the code the user points to.

## Instructions

1. Read the file, function, or snippet the user names. If they name none, ask which code to explain.
2. Do not create, modify, or delete any file.
3. Explain in this order:
   - **Purpose:** one or two sentences on what the code is for.
   - **How it works:** the main steps, in order.
   - **Inputs and outputs:** what goes in, what comes out, and any side effects.
   - **Watch out for:** edge cases or assumptions a reader should know about.
4. Reference code as `path/to/file:line`.
5. Keep the answer to about one screen of text unless the user asks for more detail.

## Example
`/explain-code src/deploy.js`
