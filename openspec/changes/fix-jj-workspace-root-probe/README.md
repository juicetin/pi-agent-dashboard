# fix-jj-workspace-root-probe

Make the bridge's jj probe populate workspaceRoot with the parent repo root so workspace sessions actually collapse under their parent in the sidebar (Phase 4c group-by-workspaceRoot is currently a no-op for non-default workspaces).
