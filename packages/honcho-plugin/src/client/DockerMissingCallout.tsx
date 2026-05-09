/**
 * Docker-missing callout — task 6.13.
 */
import React from "react";
import Icon from "@mdi/react";
import { mdiDocker, mdiOpenInNew } from "@mdi/js";

export function DockerMissingCallout() {
  return (
    <div className="border border-red-700 bg-red-900/20 rounded-lg p-3 space-y-1">
      <h4 className="text-xs font-semibold text-red-400 inline-flex items-center gap-1.5">
        <Icon path={mdiDocker} size={0.6} />
        Docker not found
      </h4>
      <p className="text-[10px] text-[var(--text-muted)]">
        Self-host mode requires Docker Desktop or Docker Engine.
        Install Docker and restart the dashboard.
      </p>
      <a
        href="https://docs.docker.com/get-docker/"
        target="_blank"
        rel="noopener noreferrer"
        className="text-[10px] text-blue-400 hover:underline inline-flex items-center gap-0.5"
      >
        Install Docker
        <Icon path={mdiOpenInNew} size={0.4} />
      </a>
    </div>
  );
}
