/**
 * Tool that lets the LLM ask the user interactive questions via dashboard UI.
 * Uses the `input` event to intercept the /ask command since dashboard-sent
 * messages bypass registerCommand.
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "ask_user",
    label: "Ask User",
    description: "Ask the user a question interactively. Use this when you need clarification, confirmation, or a choice from the user before proceeding.",
    promptSnippet: "Ask the user interactive questions (confirm, select, or free text input)",
    promptGuidelines: [
      "When you need to ask the user a question, ALWAYS use the ask_user tool instead of writing the question as plain text.",
      "Use method 'confirm' for yes/no questions, 'select' when offering specific choices, and 'input' for open-ended questions.",
      "This applies to all workflows including OpenSpec, planning, and any situation where you need user input before proceeding.",
    ],
    parameters: Type.Object({
      method: StringEnum(["confirm", "select", "input"] as const, {
        description: "Type of question: confirm (yes/no), select (pick from options), input (free text)",
      }),
      title: Type.String({ description: "The question to ask" }),
      message: Type.Optional(Type.String({ description: "Additional context (for confirm)" })),
      options: Type.Optional(Type.Array(Type.String(), { description: "Options to choose from (for select)" })),
      placeholder: Type.Optional(Type.String({ description: "Placeholder text (for input)" })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      let result: unknown;

      switch (params.method) {
        case "confirm":
          result = await ctx.ui.confirm(params.title, params.message ?? "");
          break;
        case "select":
          result = await ctx.ui.select(params.title, params.options ?? []);
          break;
        case "input":
          result = await ctx.ui.input(params.title, params.placeholder);
          break;
      }

      return {
        content: [{ type: "text", text: `User responded: ${JSON.stringify(result)}` }],
        details: { method: params.method, result },
      };
    },
  });
}
