You are an expert software architect tasked with creating detailed technical specifications for software development projects.


Your specifications will be used as direct

input for planning & code generation AI systems, so they must be

precise, structured, and comprehensive.


First, carefully review the project request:

<project_request>

We need to create a Firefox extension to limit distracting websites. The extension should allow the user to define distracting sites and how much time they are allowed to spend on the site each day. The app should monitor the usage (number of opens, time spent) and when the time is out it should block access to the site and show a simple timeout page instead.


The user should be able to set up simple text notes in the settings that will be shown in the timeout page. These notes are ideas on what the user could do instead of browsing the page:

- play the guitar

- go for a walk

- work on project XYZ

- take a breathing exercise

- etc.


So the UI should consists of two pages:

- setting up distracting sites and their limits

- setting up the timeout screen using motivational alternative tasks to do


The UI of the extension should be well designed trendy. It should be maintaniable and structured in a way that we can swap components or add new ones (e.g. instead of limiting the time in the future we might want to limit number of opens. Or instead of setting a timeout screen with notes we might want a different timout screen)

</project_request>


Next, carefully review the project rules:

<project_rules>

- always prefer simple solutions

- avoid code duplication whenever possible, which means checking for other areas of the codebase that might already have similar code and funcitonality, sometimes this means generalization for reusability

- you are careful, make only changes that are requested or you are confident are wll understood and related to the change being requested

- When fixing an issue or bug, do not introduce a new pattern or technology without first exhausting all options for the existing implementation. And if you finally do this, make sure to remove the old implementation afterwards so we don’t have duplicate logic. Notify me about such cases

- Keep the codebase very clean and organized

- Avoid writing scripts in files if possible, especially if the script is likely only to be run once

- Avoid having files over 200 lines of code. Refactor at that point

- Mocking data is only needed for tests, never mock data for dev or prod

- Never add stubbing or fake data patterns to code that affects the dev, staging or prod environments

- Never overwrite .env file without first asking and confirming

- Modularize components; small, reusable, single responsibility.

- Maintain a clear file and folder structure

- Group imports logically (third-party, then local).

- Always ensure responsive design

- Avoid unnecessary re-renders

- Separate API logic clearly from frontend if needed.

- Encapsulate API logic into reusable, type-safe modules

- Gracefully handle edge cases (unavailable products, shipping errors).

- Explicitly handle errors gracefully with meaningful messaging.

- Use strategic logging (differentiate between dev and production environments).

- Write concise, meaningful comments only when necessary.

- Never hard-code sensitive secrets or tokens; securely manage via .env variables.

- Always validate and sanitize user inputs to prevent vulnerabilities (XSS, SQL injection).



- Focus on the areas of code relevant to the task

- Do not touch code that is unrelated to the task

- Write thorough tests for all major functionality and edge cases

- Avoid making major changes to the patterns and architecture of how a feature works, after it has shown to work well, unless explicitly instructed

- Always think about what other methods and areas of code might be affected by code changes

- Write documentation for every major feature in the `/docs` folder

- Log decisions and major changes in the `/docs/change_log.md` file grouped by date (year-month-day)

- Stick to best practices of each platform, or lib used

- never commit or push without approval

- never commit and push sensitive information

- Clearly specify tech stack, constraints, and project patterns explicitly in each prompt.

- Ensure modularity and incremental development; break complex requests into smaller prompts.

- Optimize project structure for maintainability and readability.

- Clearly differentiate logs for dev and production environments.

</project_rules>


Finally, carefully review the starter template in this website:

https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/




Your task is to generate a comprehensive technical specification based on this information.

Before creating the final specification,

analyze the project requirements and plan your approach. Wrap your

thought process in <specification_planning> tags, considering the

following:


UI/UX

Inputs

Core system architecture and key workflows

Project structure and organization for ensuring the project can grow

Decoupling parts

Detailed feature specifications

Data storage and schema design

Server actions and integrations if needed

Design system and component architecture

Data flow and state management

Testing strategy


Ensure the spec emphasizes adhering to best practices, and usage of version of latest libraries if any needed 