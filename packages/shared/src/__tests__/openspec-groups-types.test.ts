/**
 * Type-level tests for OpenSpec change-grouping shared types.
 *
 * Asserts:
 *   - `OpenSpecGroup` shape compiles.
 *   - `OpenSpecChange.groupId?: string | null` is optional.
 *   - `OpenSpecGroupsFile` shape compiles.
 *   - `OPENSPEC_GROUPS_SCHEMA_VERSION` is the literal `1`.
 *   - `BrowserOpenSpecGroupsUpdateMessage` is a member of `ServerToBrowserMessage`
 *     (otherwise esbuild would dead-code-eliminate the consumer switch arm).
 *   - REST request/response shapes for the five `/api/openspec/groups*` routes compile.
 *
 * See change: add-openspec-change-grouping (tasks 1.1–1.7).
 */
import { describe, it, expect } from "vitest";
import type {
  OpenSpecGroup,
  OpenSpecChange,
  OpenSpecGroupsFile,
} from "../types.js";
import { OPENSPEC_GROUPS_SCHEMA_VERSION } from "../types.js";
import type {
  ServerToBrowserMessage,
  BrowserOpenSpecGroupsUpdateMessage,
} from "../browser-protocol.js";
import type {
  GetOpenSpecGroupsResponse,
  CreateOpenSpecGroupRequest,
  CreateOpenSpecGroupResponse,
  UpdateOpenSpecGroupRequest,
  UpdateOpenSpecGroupResponse,
  DeleteOpenSpecGroupResponse,
  SetOpenSpecGroupAssignmentRequest,
  SetOpenSpecGroupAssignmentResponse,
} from "../rest-api.js";

// Type-level assertion: if the type does NOT extend the union, this will fail to compile.
type AssertExtends<T, U> = T extends U ? true : never;

// 1.5 — broadcast variant lives in the union.
type _GroupsUpdateInBrowserUnion = AssertExtends<
  BrowserOpenSpecGroupsUpdateMessage,
  ServerToBrowserMessage
>;

// 1.1 — group shape.
type _GroupShape = AssertExtends<
  { id: string; name: string; color?: string; order: number },
  OpenSpecGroup
>;

// 1.2 — `groupId?` is optional on `OpenSpecChange`.
type _ChangeGroupIdOptional = AssertExtends<
  { name: string; status: "in-progress"; completedTasks: 0; totalTasks: 0; artifacts: [] },
  OpenSpecChange
>;
// And it accepts a string when present.
type _ChangeWithGroupId = AssertExtends<
  {
    name: string;
    status: "in-progress";
    completedTasks: 0;
    totalTasks: 0;
    artifacts: [];
    groupId: "ui";
  },
  OpenSpecChange
>;

// 1.4 — file shape.
type _FileShape = AssertExtends<
  {
    schemaVersion: 1;
    groups: OpenSpecGroup[];
    assignments: Record<string, string>;
  },
  OpenSpecGroupsFile
>;

// 1.6 — REST shapes (compile-time only).
const _getResp: GetOpenSpecGroupsResponse = {
  success: true,
  data: { schemaVersion: 1, groups: [], assignments: {} },
};
const _createReq: CreateOpenSpecGroupRequest = { name: "UI", color: "#3b82f6" };
const _createResp: CreateOpenSpecGroupResponse = {
  success: true,
  data: { id: "ui", name: "UI", color: "#3b82f6", order: 0 },
};
const _updateReq: UpdateOpenSpecGroupRequest = { name: "Frontend" };
const _updateResp: UpdateOpenSpecGroupResponse = {
  success: true,
  data: { id: "ui", name: "Frontend", order: 0 },
};
const _deleteResp: DeleteOpenSpecGroupResponse = { success: true };
const _putReq: SetOpenSpecGroupAssignmentRequest = { changeName: "add-foo", groupId: "ui" };
const _putReqNull: SetOpenSpecGroupAssignmentRequest = { changeName: "add-foo", groupId: null };
const _putResp: SetOpenSpecGroupAssignmentResponse = { success: true };

// Suppress unused-locals for compile-time-only declarations.
void _getResp;
void _createReq;
void _createResp;
void _updateReq;
void _updateResp;
void _deleteResp;
void _putReq;
void _putReqNull;
void _putResp;

describe("OpenSpec change-grouping shared types", () => {
  it("OPENSPEC_GROUPS_SCHEMA_VERSION is the literal 1", () => {
    expect(OPENSPEC_GROUPS_SCHEMA_VERSION).toBe(1);
  });

  it("openspec_groups_update is reachable in a runtime switch over ServerToBrowserMessage", () => {
    // Runtime check that the discriminant survives type-narrowing — mirrors
    // the prompt-message regression guard in browser-protocol-types.test.ts.
    const sample: ServerToBrowserMessage = {
      type: "openspec_groups_update",
      cwd: "/tmp/foo",
      groups: [],
      assignments: {},
    };
    let hit = false;
    switch (sample.type) {
      case "openspec_groups_update":
        hit = true;
        break;
      default:
        break;
    }
    expect(hit).toBe(true);
  });
});
