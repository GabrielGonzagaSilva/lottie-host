#!/usr/bin/env python3
import json
import os
import socket
import ssl
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

BASE_DIR = Path(__file__).resolve().parent
CONFIG_PATH = BASE_DIR / "sites.json"
OUTPUT_PATH = BASE_DIR / "status.json"
TIMEOUT = 12
SLOW_MS = 3000


def now_iso():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def check_ssl(url):
    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.hostname:
        return None
    port = parsed.port or 443
    try:
        ctx = ssl.create_default_context()
        with socket.create_connection((parsed.hostname, port), timeout=TIMEOUT) as sock:
            with ctx.wrap_socket(sock, server_hostname=parsed.hostname) as tls_sock:
                cert = tls_sock.getpeercert()
        expires_raw = cert.get("notAfter")
        if not expires_raw:
            return None
        expires = datetime.strptime(expires_raw, "%b %d %H:%M:%S %Y %Z").replace(tzinfo=timezone.utc)
        remaining = expires - datetime.now(timezone.utc)
        return {
            "expires_at": expires.isoformat().replace("+00:00", "Z"),
            "days_remaining": remaining.days,
        }
    except Exception as exc:
        return {"error": str(exc)}


def fetch_github_issues(repo):
    if not repo:
        return []
    url = f"https://api.github.com/repos/{repo}/issues?state=open&per_page=6"
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "Gabriel-Ops-Monitor/1.0",
    }
    token = os.getenv("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        req = Request(url, headers=headers)
        with urlopen(req, timeout=TIMEOUT) as response:
            payload = json.loads(response.read().decode("utf-8"))
        issues = []
        for item in payload:
            if "pull_request" in item:
                continue
            issues.append(
                {
                    "severity": "warning",
                    "title": f"GitHub #{item.get('number')}: {item.get('title', 'Issue aberto')}",
                    "detail": "Issue aberto no repositório",
                    "url": item.get("html_url"),
                    "source": "github",
                }
            )
        return issues[:5]
    except Exception:
        return []


def check_site(site):
    started = time.perf_counter()
    checked_at = now_iso()
    issues = list(site.get("manual_issues", []))
    status = "offline"
    status_code = None
    final_url = site["url"]
    error = None

    try:
        req = Request(
            site["url"],
            headers={
                "User-Agent": "Mozilla/5.0 (compatible; Gabriel-Ops-Monitor/1.0)",
                "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
            },
            method="GET",
        )
        with urlopen(req, timeout=TIMEOUT) as response:
            status_code = response.getcode()
            final_url = response.geturl()
            response.read(2048)

        latency_ms = round((time.perf_counter() - started) * 1000)
        if 200 <= status_code < 400:
            status = "degraded" if latency_ms >= SLOW_MS else "online"
        elif 400 <= status_code < 500:
            status = "degraded"
        else:
            status = "offline"

        if final_url.rstrip("/") != site["url"].rstrip("/"):
            issues.append(
                {
                    "severity": "info",
                    "title": "Redirecionamento detectado",
                    "detail": f"Destino final: {final_url}",
                }
            )

        if latency_ms >= SLOW_MS:
            issues.append(
                {
                    "severity": "warning",
                    "title": "Resposta lenta",
                    "detail": f"Tempo de resposta: {latency_ms} ms",
                }
            )

        if status_code >= 400:
            issues.append(
                {
                    "severity": "critical" if status_code >= 500 else "warning",
                    "title": f"HTTP {status_code}",
                    "detail": "O endpoint respondeu com erro HTTP.",
                }
            )

    except HTTPError as exc:
        latency_ms = round((time.perf_counter() - started) * 1000)
        status_code = exc.code
        final_url = exc.geturl() or site["url"]
        status = "offline" if exc.code >= 500 else "degraded"
        error = f"HTTP {exc.code}: {exc.reason}"
        issues.append(
            {
                "severity": "critical" if exc.code >= 500 else "warning",
                "title": f"HTTP {exc.code}",
                "detail": str(exc.reason),
            }
        )
    except (URLError, TimeoutError, socket.timeout, OSError) as exc:
        latency_ms = round((time.perf_counter() - started) * 1000)
        status = "offline"
        error = str(exc)
        issues.append(
            {
                "severity": "critical",
                "title": "Site indisponível",
                "detail": str(exc),
            }
        )
    except Exception as exc:
        latency_ms = round((time.perf_counter() - started) * 1000)
        status = "offline"
        error = str(exc)
        issues.append(
            {
                "severity": "critical",
                "title": "Falha inesperada na checagem",
                "detail": str(exc),
            }
        )

    ssl_info = check_ssl(site["url"])
    if ssl_info:
        if ssl_info.get("error"):
            issues.append(
                {
                    "severity": "warning",
                    "title": "Falha ao validar SSL",
                    "detail": ssl_info["error"],
                }
            )
        elif ssl_info.get("days_remaining", 999) < 21:
            issues.append(
                {
                    "severity": "warning",
                    "title": "Certificado SSL perto do vencimento",
                    "detail": f"Restam {ssl_info['days_remaining']} dias.",
                }
            )

    issues.extend(fetch_github_issues(site.get("repo")))

    return {
        "id": site["id"],
        "name": site["name"],
        "url": site["url"],
        "repo": site.get("repo"),
        "status": status,
        "status_code": status_code,
        "latency_ms": latency_ms,
        "checked_at": checked_at,
        "final_url": final_url,
        "ssl": ssl_info,
        "error": error,
        "issues": issues,
    }


def main():
    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    results = [check_site(site) for site in config["sites"]]
    counts = {
        "online": sum(1 for item in results if item["status"] == "online"),
        "degraded": sum(1 for item in results if item["status"] == "degraded"),
        "offline": sum(1 for item in results if item["status"] == "offline"),
    }
    overall = "offline" if counts["offline"] else ("degraded" if counts["degraded"] else "online")
    payload = {
        "generated_at": now_iso(),
        "overall": overall,
        "counts": counts,
        "sites": results,
    }
    OUTPUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(payload, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
