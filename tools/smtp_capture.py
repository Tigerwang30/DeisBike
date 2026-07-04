#!/usr/bin/env python3
"""
DeisBikes local SMTP capture server.

Simulates email delivery for local development — no real email is sent.
Every magic link delivered by the app is printed here so you can click it.

Usage:
    # Terminal 1 — start this capture server
    python3 tools/smtp_capture.py

    # .env must have:
    #   SMTP_HOST=localhost
    #   SMTP_PORT=1025
    #   SMTP_USER=
    #   SMTP_PASSWORD=

    # Then open http://localhost:3000/login, enter a @brandeis.edu address,
    # and the magic link will appear in this terminal.
"""

import asyncio
import re
import sys


def _extract_magic_link(body: str) -> str | None:
    matches = re.findall(r"https?://\S+/auth/verify\?token=\S+", body)
    if matches:
        return matches[0].rstrip('.,;)">')
    return None


def _print_email(recipients: list[str], body: str) -> None:
    link = _extract_magic_link(body)
    sep  = "=" * 62
    print(f"\n{sep}")
    print(f"  NEW EMAIL  →  {', '.join(recipients)}")
    if link:
        print()
        print("  MAGIC LINK — paste in browser to log in:")
        print(f"  {link}")
    else:
        print("  (no magic link found in body)")
    print(f"{sep}\n", flush=True)


class SMTPSession(asyncio.Protocol):
    """Minimal SMTP server session — handles one client connection."""

    def __init__(self):
        self._buf        = b""
        self._in_data    = False
        self._data_lines: list[str] = []
        self._recipients: list[str] = []
        self._transport  = None

    def connection_made(self, transport):
        self._transport = transport
        self._send("220 localhost DeisBikes SMTP capture ready")

    def data_received(self, data: bytes):
        self._buf += data
        while b"\r\n" in self._buf:
            line, self._buf = self._buf.split(b"\r\n", 1)
            self._handle_line(line.decode("utf-8", errors="replace"))

    def _handle_line(self, line: str):
        if self._in_data:
            if line == ".":
                # End of DATA
                self._in_data = False
                body = "\r\n".join(self._data_lines)
                _print_email(self._recipients, body)
                self._data_lines = []
                self._recipients = []
                self._send("250 OK: message accepted")
            else:
                # Dot-stuffing: leading dot is removed
                self._data_lines.append(line[1:] if line.startswith("..") else line)
            return

        upper = line.upper()

        if upper.startswith("EHLO") or upper.startswith("HELO"):
            self._send("250-localhost\r\n250-SIZE 10240000\r\n250 OK")

        elif upper.startswith("MAIL FROM"):
            self._send("250 OK")

        elif upper.startswith("RCPT TO"):
            addr = re.search(r"<([^>]+)>", line)
            if addr:
                self._recipients.append(addr.group(1))
            self._send("250 OK")

        elif upper == "DATA":
            self._send("354 Start input; end with <CRLF>.<CRLF>")
            self._in_data = True

        elif upper == "QUIT":
            self._send("221 Bye")
            self._transport.close()

        elif upper.startswith("RSET"):
            self._recipients = []
            self._data_lines = []
            self._send("250 OK")

        elif upper.startswith("NOOP"):
            self._send("250 OK")

        else:
            self._send("500 Command not recognised")

    def _send(self, msg: str):
        self._transport.write((msg + "\r\n").encode())


async def main():
    host = "localhost"
    port = 1025

    loop   = asyncio.get_running_loop()
    server = await loop.create_server(SMTPSession, host, port)

    sep = "=" * 62
    print(sep)
    print("  DeisBikes SMTP Capture Server")
    print(f"  Listening on {host}:{port}")
    print()
    print("  .env settings required:")
    print("    SMTP_HOST=localhost")
    print("    SMTP_PORT=1025")
    print("    SMTP_USER=")
    print("    SMTP_PASSWORD=")
    print()
    print("  Waiting for magic link emails...")
    print(sep)
    print(flush=True)

    async with server:
        await server.serve_forever()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nStopping capture server.")
        sys.exit(0)
