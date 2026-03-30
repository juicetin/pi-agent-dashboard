/** Inputs for computing mobile navigation depth */
export interface MobileDepthInput {
  selectedId?: string;
  selectedTerminalId?: string;
  settingsMatch?: boolean;
  tunnelSetupMatch?: boolean;
  hasPreview?: boolean;
}

/**
 * Compute MobileShell depth: 0 = list, 1 = detail, 2 = preview.
 */
export function getMobileDepth(input: MobileDepthInput): number {
  if (input.hasPreview) return 2;
  if (input.selectedId || input.selectedTerminalId || input.settingsMatch || input.tunnelSetupMatch) return 1;
  return 0;
}
