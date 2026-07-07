// Package testfile is the desktop app's view of a test file. It
// converts between the domain's flat action list (the source of
// truth, stored on disk as YAML) and the canvas-facing graph
// (nodes, edges, start node). This is a desktop-app concern — the
// CLI and the API don't need it — so it lives here, not in
// libs/domain.
package testfile

import (
	"sort"

	"github.com/thani-sh/provar/libs/domain"
)

// GraphStartID is the reserved id of the synthetic start node in the
// canvas's graph view. The action list does not contain it; the
// conversion adds it and connects it to every entry point.
const GraphStartID = "__start__"

// View is the JSON shape the canvas consumes. It is a derived view
// of the action list — the source of truth is the action list
// stored in the test file. The canvas does not edit this view
// directly; it edits the action list through WriteTestFile.
type View struct {
	Graph Graph `json:"graph"`
	// Order preserves the source file's action order. The canvas
	// ignores it; the inverse uses it to reconstruct the slice in
	// the original order after a round-trip.
	Order []string `json:"order,omitempty"`
}

// Graph is the canvas-facing graph. Nodes is keyed by action id for
// O(1) lookup; Order is the source ordering.
type Graph struct {
	Start string          `json:"start"`
	Nodes map[string]Node `json:"nodes"`
	Edges []Edge          `json:"edges"`
}

// Node is the canvas-facing view of a single action.
type Node struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	Info  string `json:"info,omitempty"`
}

// Edge is a directed edge between two nodes (or from the start node
// to an entry-point action). Implicit is set on edges that were
// synthesised by FromActions to represent the file's positional
// ordering — they have no source in the user's explicit Next fields
// and are dropped by ToActions to keep the round-trip faithful.
type Edge struct {
	From     string `json:"from"`
	To       string `json:"to"`
	Implicit bool   `json:"implicit,omitempty"`
}

// FromActions converts the domain's action list into the canvas's
// graph view. For actions with empty Next and a successor in the
// list, an implicit edge to the next action is added so the canvas
// can lay a linear chain out. The start node points to every entry
// point (action with no incoming edge from any other action).
func FromActions(actions []domain.Action) View {
	nodes := make(map[string]Node, len(actions))
	for _, a := range actions {
		nodes[a.ID] = Node{ID: a.ID, Title: a.Name, Info: a.Info}
	}

	incoming := make(map[string]bool, len(actions))
	var edges []Edge
	for i, a := range actions {
		explicit := a.Next
		if len(explicit) == 0 && i+1 < len(actions) {
			// No explicit Next — synthesise a position edge so the
			// canvas can lay a linear chain out. Mark it implicit so
			// the inverse can drop it.
			edges = append(edges, Edge{From: a.ID, To: actions[i+1].ID, Implicit: true})
			incoming[actions[i+1].ID] = true
			continue
		}
		for _, next := range explicit {
			edges = append(edges, Edge{From: a.ID, To: next})
			incoming[next] = true
		}
	}
	for _, a := range actions {
		if !incoming[a.ID] {
			edges = append(edges, Edge{From: GraphStartID, To: a.ID})
		}
	}

	order := make([]string, len(actions))
	for i, a := range actions {
		order[i] = a.ID
	}

	return View{
		Graph: Graph{
			Start: GraphStartID,
			Nodes: nodes,
			Edges: edges,
		},
		Order: order,
	}
}

// ToActions is the inverse of FromActions. It reconstructs the
// action list from the canvas's view, using Order to preserve the
// source ordering. Edges with From == GraphStartID (synthesised
// entry-point edges) and edges with Implicit == true (synthesised
// position edges) are dropped — neither has a source in the user's
// explicit Next fields.
func ToActions(view View) []domain.Action {
	nextByID := make(map[string][]string)
	for _, e := range view.Graph.Edges {
		if e.From == GraphStartID || e.Implicit {
			continue
		}
		nextByID[e.From] = append(nextByID[e.From], e.To)
	}

	var ids []string
	if len(view.Order) > 0 {
		ids = view.Order
	} else {
		ids = make([]string, 0, len(view.Graph.Nodes))
		for id := range view.Graph.Nodes {
			ids = append(ids, id)
		}
		sort.Strings(ids)
	}

	actions := make([]domain.Action, 0, len(ids))
	for _, id := range ids {
		n, ok := view.Graph.Nodes[id]
		if !ok {
			continue
		}
		actions = append(actions, domain.Action{
			ID:   n.ID,
			Name: n.Title,
			Info: n.Info,
			Next: nextByID[id],
		})
	}
	return actions
}
