package testfile

import (
	"testing"

	"github.com/thani-sh/provar/libs/domain"
)

func TestFromActions_LinearChain(t *testing.T) {
	// Sample test file shape — no Next fields, order implies the chain.
	actions := []domain.Action{
		{ID: "open_login", Name: "Open Login", Info: "navigate"},
		{ID: "enter_creds", Name: "Enter Credentials", Info: "fill form"},
		{ID: "click_login", Name: "Click Login", Info: "submit"},
		{ID: "verify", Name: "Verify Dashboard", Info: "check url"},
	}
	view := FromActions(actions)

	if view.Graph.Start != GraphStartID {
		t.Errorf("Start = %q, want %q", view.Graph.Start, GraphStartID)
	}
	if len(view.Graph.Nodes) != 4 {
		t.Errorf("Nodes = %d, want 4", len(view.Graph.Nodes))
	}
	// Linear chain: 3 implicit position edges + 1 start-to-first edge = 4.
	wantEdges := 4
	if len(view.Graph.Edges) != wantEdges {
		t.Errorf("Edges = %d, want %d", len(view.Graph.Edges), wantEdges)
	}
	if got := view.Order; len(got) != 4 {
		t.Errorf("Order len = %d, want 4", len(got))
	}
}

func TestFromActions_DAGWithExplicitNext(t *testing.T) {
	actions := []domain.Action{
		{ID: "a", Name: "A", Next: []string{"b", "c"}},
		{ID: "b", Name: "B"},
		{ID: "c", Name: "C"},
	}
	view := FromActions(actions)
	// Explicit edges: a→b, a→c (2).
	// b has no Next and is followed by c in the list — implicit b→c (1).
	// Entry point: a has no incoming — start→a (1).
	wantEdges := 4
	if len(view.Graph.Edges) != wantEdges {
		t.Errorf("Edges = %d, want %d", len(view.Graph.Edges), wantEdges)
	}
}

func TestRoundTrip_PreservesOrder(t *testing.T) {
	actions := []domain.Action{
		{ID: "open_login", Name: "Open Login", Info: "navigate"},
		{ID: "enter_creds", Name: "Enter Credentials", Info: "fill form"},
		{ID: "click_login", Name: "Click Login", Info: "submit"},
	}
	view := FromActions(actions)
	back := ToActions(view)
	if len(back) != len(actions) {
		t.Fatalf("round-trip length = %d, want %d", len(back), len(actions))
	}
	for i, a := range back {
		if a.ID != actions[i].ID {
			t.Errorf("[%d] ID = %q, want %q", i, a.ID, actions[i].ID)
		}
		if a.Name != actions[i].Name {
			t.Errorf("[%d] Name = %q, want %q", i, a.Name, actions[i].Name)
		}
		if a.Info != actions[i].Info {
			t.Errorf("[%d] Info = %q, want %q", i, a.Info, actions[i].Info)
		}
	}
}

func TestRoundTrip_DAGPreservesExplicitNext(t *testing.T) {
	actions := []domain.Action{
		{ID: "a", Name: "A", Next: []string{"b", "c"}},
		{ID: "b", Name: "B"},
		{ID: "c", Name: "C"},
	}
	view := FromActions(actions)
	back := ToActions(view)
	if len(back) != 3 {
		t.Fatalf("length = %d, want 3", len(back))
	}
	if len(back[0].Next) != 2 {
		t.Errorf("a.Next = %v, want 2 entries", back[0].Next)
	}
	// b's implicit edge to c was synthesised by the conversion. After
	// round-trip, b's Next should be empty (we drop synthesised edges
	// at the inverse, and b had no explicit successor).
	if len(back[1].Next) != 0 {
		t.Errorf("b.Next = %v, want 0 entries (implicit edge dropped)", back[1].Next)
	}
}
