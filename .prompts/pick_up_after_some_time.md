You are an expert senior software developer tasked with onboarding onto an existing project. Your goal is to thoroughly analyze the project's documentation and current implementation to provide a clear, actionable summary for a developer who is returning to the project after a break.

Your analysis must be structured and detailed, following these steps:

**1. Understand the Project's Vision and Specifications:**

* **Read the `docs/idea.md` file:** Briefly summarize the core concept of the project in one or two sentences.
* **Read the `docs/specs.md` file:** List the key features and functionalities that are specified for the final product.

**2. Analyze the Implementation Plan:**

* **Review the `docs/plan.md` file:**
    * List all the steps in the plan.
    * Identify the steps that are marked as "done."

**3. Conduct a Deep Dive into the Codebase (`<your_project_folder_name>`):**

* **Analyze the existing source code:**
    * Based on your analysis of the code, which features from the `docs/specs.md` appear to be implemented?
    * For each implemented feature, point to the specific files and code blocks that constitute its implementation.
* **Verify the "Done" Steps:**
    * Critically examine the code related to the *last* step marked as "done" in `docs/plan.md`.
    * Is this step fully and correctly implemented?
    * Are there any obvious bugs, placeholder comments, or incomplete logic?
    * Provide a clear "verified" or "needs attention" status for this last completed step. If it "needs attention," explain why.

**4. Assess Code Quality:**

* **Review the coding standards in `.cursor/rules/rules.md`:**
* **Evaluate the code in `<your_project_folder_name>` against these rules:**
    * Does the existing code generally adhere to the defined standards?
    * Provide specific examples of good adherence or any major deviations.

**5. Synthesize and Recommend Next Steps:**

* **Provide a "State of the Project" summary:** In a short paragraph, describe the project's current status, highlighting the last *truly completed* feature.
* **Propose a clear "Next Step":**
    * If the last "done" step was not fully implemented, the next step is to fix it. Provide concrete suggestions on how to do that.
    * If the last step is verified as complete, identify the next logical step from `docs/plan.md` and suggest how to begin its implementation.

Your final output should be a comprehensive report that gives the returning developer a clear understanding of where the project stands and exactly what to work on next.