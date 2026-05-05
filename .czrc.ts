import { createRequire } from "node:module";
import { CONVENTIONAL_COMMIT } from "./metadata/version-and-release.ts";

const require = createRequire(import.meta.url);
const conventionalChangelog = require("cz-conventional-changelog");
const baseAdapter = conventionalChangelog;

export default {
  prompter(cz: any, commit: (message: string) => void) {
    const originalPrompt = cz.prompt.bind(cz);

    cz.prompt = (questions: any[]) => {
      const modifiedQuestions = questions.map((question: any) => {
        if (question.name !== "scope") return question;

        return {
          ...question,
          type: "list",
          choices: CONVENTIONAL_COMMIT.SCOPES.map((scope) => ({
            name: scope,
            value: scope,
          })),
        };
      });

      return originalPrompt(modifiedQuestions);
    };

    return baseAdapter.prompter(cz, commit);
  },
};
