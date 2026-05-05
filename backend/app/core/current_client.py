def get_current_client_id() -> str:
    """Return the current mock client id until real auth provides context."""
    return "client_acme"
