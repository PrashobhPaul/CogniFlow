import type { Edge, Node } from "@xyflow/react";
import type { ArchNodeData, FlowEdgeData } from "./types";

export type ArchNode = Node<ArchNodeData, "arch">;
export type FlowEdge = Edge<FlowEdgeData, "flow">;
