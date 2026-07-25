import os


def get_module_from_file_path(file_path: str) -> str:
    """Return the top-level directory as the module name.
    e.g. 'src/auth/login.py' -> 'auth'
         'index.py' -> 'root'
    """
    if not file_path:
        return 'root'
    parts = file_path.replace('\\', '/').split('/')
    if len(parts) == 1:
        return 'root'
    # Skip common top-level wrappers like 'src'
    if parts[0] in ('src', 'lib', 'app', 'apps') and len(parts) > 2:
        return parts[1]
    return parts[0]
