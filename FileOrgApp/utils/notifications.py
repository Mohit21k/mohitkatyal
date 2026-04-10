import os

def notify_mac(title: str, message: str):
    """
    Triggers a native macOS slide-in toast notification using AppleScript (osascript).
    """
    # Escaping quotes to prevent AppleScript injection syntax errors
    title_escaped = title.replace('"', '\\"')
    message_escaped = message.replace('"', '\\"')
    
    script = f'display notification "{message_escaped}" with title "{title_escaped}" sound name "Morse"'
    os.system(f"osascript -e '{script}'")
