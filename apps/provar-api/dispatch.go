package api

// dispatch is the central registry of wire types to handlers. Populated
// by Register from init() in each handlers/*.go file. The table holds
// Handler interface values so each entry can be a struct that embeds
// api.BaseHandler and implements Handle.
var dispatch = map[string]Handler{}

// Register adds a handler to the dispatch table. Called from package init()
// in handlers/*.go files — keeps registration co-located with the handler.
func Register(typ string, h Handler) {
	dispatch[typ] = h
}

// lookup returns the handler for typ, or nil if no handler is registered.
// Server logs and closes the connection when a handler is missing — that's
// a protocol-level error, not a domain error.
func lookup(typ string) Handler {
	return dispatch[typ]
}
