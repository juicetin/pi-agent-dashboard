import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { dracula } from "react-syntax-highlighter/dist/esm/styles/prism";
import { nord } from "react-syntax-highlighter/dist/esm/styles/prism";
import { ghcolors } from "react-syntax-highlighter/dist/esm/styles/prism";
import { getTheme } from "./themes.js";

const syntaxStyles: Record<string, Record<string, unknown>> = {
  oneDark,
  oneLight,
  dracula,
  nord,
  ghcolors,
};

export function getSyntaxTheme(resolved: "light" | "dark", themeName: string = "base"): Record<string, unknown> {
  const theme = getTheme(themeName);
  if (theme) {
    const styleName = resolved === "light" ? theme.syntaxLight : theme.syntaxDark;
    const style = syntaxStyles[styleName];
    if (style) return style;
  }
  // Fallback
  return resolved === "light" ? oneLight : oneDark;
}
