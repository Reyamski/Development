import asyncio
import configparser
import re
import time
from datetime import datetime
from pathlib import Path
from typing import AsyncGenerator, Any

from utils.aws import get_sso_client, get_sso_portal_client


CONFIG_PATH = Path.home() / ".aws" / "config"


async def start_sso_flow(start_url: str, sso_region: str) -> AsyncGenerator[dict, None]:
    """
    Async generator that drives the AWS SSO OIDC device authorization flow.
    Yields SSE-ready dicts as the flow progresses.
    """
    oidc = get_sso_client(sso_region)

    # Step 1: Register public client
    try:
        creds = await asyncio.to_thread(
            oidc.register_client,
            clientName="rds-dba-tools",
            clientType="public",
        )
    except Exception as e:
        yield {"type": "error", "message": f"Failed to register OIDC client: {e}"}
        return

    client_id = creds["clientId"]
    client_secret = creds["clientSecret"]

    # Step 2: Start device authorization
    try:
        device_auth = await asyncio.to_thread(
            oidc.start_device_authorization,
            clientId=client_id,
            clientSecret=client_secret,
            startUrl=start_url,
        )
    except Exception as e:
        yield {"type": "error", "message": f"Failed to start device authorization: {e}"}
        return

    verification_url = device_auth["verificationUriComplete"]
    device_code = device_auth["deviceCode"]
    interval = device_auth.get("interval", 5)
    expires_in = device_auth.get("expiresIn", 600)

    yield {"type": "device_auth", "url": verification_url, "userCode": device_auth.get("userCode", "")}
    yield {"type": "progress", "message": "Waiting for browser login..."}

    # Step 3: Poll for token
    access_token = await _poll_for_token(
        oidc, client_id, client_secret, device_code, interval, expires_in
    )

    if access_token is None:
        yield {"type": "error", "message": "Login timed out or was cancelled."}
        return

    yield {"type": "progress", "message": "Authenticated. Enumerating accounts..."}

    # Step 4: List all accounts and roles
    sso = get_sso_portal_client(sso_region)
    try:
        accounts = await asyncio.to_thread(_list_all_accounts, sso, access_token)
    except Exception as e:
        yield {"type": "error", "message": f"Failed to list accounts: {e}"}
        return

    total_roles = 0
    for account in accounts:
        try:
            roles = await asyncio.to_thread(
                _list_account_roles, sso, access_token, account["accountId"]
            )
        except Exception:
            roles = []

        for role in roles:
            total_roles += 1
            yield {
                "type": "account",
                "account": {
                    "accountId": account["accountId"],
                    "accountName": account["accountName"],
                    "roleName": role["roleName"],
                },
            }

    yield {"type": "done", "total": total_roles}


async def _poll_for_token(
    oidc, client_id: str, client_secret: str, device_code: str, interval: int, expires_in: int
) -> str | None:
    deadline = time.monotonic() + expires_in
    sleep_interval = interval

    while time.monotonic() < deadline:
        await asyncio.sleep(sleep_interval)
        try:
            resp = await asyncio.to_thread(
                oidc.create_token,
                clientId=client_id,
                clientSecret=client_secret,
                grantType="urn:ietf:params:oauth:grant-type:device_code",
                deviceCode=device_code,
            )
            return resp["accessToken"]
        except oidc.exceptions.AuthorizationPendingException:
            pass
        except oidc.exceptions.SlowDownException:
            sleep_interval += 5
        except Exception:
            return None

    return None


def _list_all_accounts(sso, access_token: str) -> list[dict]:
    accounts = []
    paginator = sso.get_paginator("list_accounts")
    for page in paginator.paginate(accessToken=access_token):
        accounts.extend(page.get("accountList", []))
    return accounts


def _list_account_roles(sso, access_token: str, account_id: str) -> list[dict]:
    roles = []
    paginator = sso.get_paginator("list_account_roles")
    for page in paginator.paginate(accessToken=access_token, accountId=account_id):
        roles.extend(page.get("roleList", []))
    return roles


def _sanitize_name(name: str) -> str:
    """Convert account/role names to safe profile name segments."""
    name = re.sub(r"[^a-zA-Z0-9\-_]", "-", name)
    name = re.sub(r"-+", "-", name)
    return name.strip("-")


def generate_aws_config(
    accounts: list[dict],
    start_url: str,
    sso_region: str,
    app_region: str,
    overwrite: bool,
    fmt: str = "sso-session",
) -> dict[str, Any]:
    """
    Write profiles to ~/.aws/config.
    Returns {written: N, backupPath: str|None}.
    """
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)

    # Backup existing config
    backup_path = None
    if CONFIG_PATH.exists():
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = str(CONFIG_PATH.parent / f"config.{ts}.bak")
        import shutil
        shutil.copy2(CONFIG_PATH, backup_path)

    if overwrite or not CONFIG_PATH.exists():
        lines = _build_config_lines(accounts, start_url, sso_region, app_region, fmt)
        CONFIG_PATH.write_text("\n".join(lines) + "\n")
    else:
        _merge_config(accounts, start_url, sso_region, app_region, fmt)

    return {"written": len(accounts), "backupPath": backup_path}


def _build_config_lines(
    accounts: list[dict],
    start_url: str,
    sso_region: str,
    app_region: str,
    fmt: str,
) -> list[str]:
    lines: list[str] = []

    if fmt == "sso-session":
        lines += [
            "[sso-session rds-dba-tools-sso]",
            f"sso_start_url = {start_url}",
            f"sso_region = {sso_region}",
            "sso_registration_scopes = sso:account:access",
            "",
        ]

    for acc in accounts:
        profile_name = acc.get("profileName") or (
            f"{_sanitize_name(acc['accountName'])}-{_sanitize_name(acc['roleName'])}"
        )
        lines.append(f"[profile {profile_name}]")
        if fmt == "sso-session":
            lines.append("sso_session = rds-dba-tools-sso")
        else:
            lines += [
                f"sso_start_url = {start_url}",
                f"sso_region = {sso_region}",
            ]
        lines += [
            f"sso_account_id = {acc['accountId']}",
            f"sso_role_name = {acc['roleName']}",
            f"region = {app_region}",
            "output = json",
            "",
        ]

    return lines


def _merge_config(
    accounts: list[dict],
    start_url: str,
    sso_region: str,
    app_region: str,
    fmt: str,
) -> None:
    """Merge generated profiles into existing config, preserving other sections."""
    existing = CONFIG_PATH.read_text()

    # Build map of new profiles
    new_profiles: dict[str, list[str]] = {}
    for acc in accounts:
        profile_name = acc.get("profileName") or (
            f"{_sanitize_name(acc['accountName'])}-{_sanitize_name(acc['roleName'])}"
        )
        block = [f"[profile {profile_name}]"]
        if fmt == "sso-session":
            block.append("sso_session = rds-dba-tools-sso")
        else:
            block += [
                f"sso_start_url = {start_url}",
                f"sso_region = {sso_region}",
            ]
        block += [
            f"sso_account_id = {acc['accountId']}",
            f"sso_role_name = {acc['roleName']}",
            f"region = {app_region}",
            "output = json",
            "",
        ]
        new_profiles[f"[profile {profile_name}]"] = block

    # Parse and reconstruct, replacing matching sections
    result_lines: list[str] = []
    current_section_header: str | None = None
    current_section_lines: list[str] = []
    in_generated_section = False

    def flush_section():
        nonlocal in_generated_section
        if in_generated_section and current_section_header in new_profiles:
            result_lines.extend(new_profiles.pop(current_section_header))
        else:
            result_lines.extend(current_section_lines)

    for line in existing.splitlines():
        stripped = line.strip()
        if stripped.startswith("[") and stripped.endswith("]"):
            if current_section_header is not None:
                flush_section()
            current_section_header = stripped
            current_section_lines = [line]
            in_generated_section = stripped in new_profiles
        else:
            current_section_lines.append(line)

    if current_section_header is not None:
        flush_section()

    # Append sso-session block if not present and using new format
    if fmt == "sso-session":
        sso_session_header = "[sso-session rds-dba-tools-sso]"
        joined = "\n".join(result_lines)
        if sso_session_header not in joined:
            result_lines = [
                sso_session_header,
                f"sso_start_url = {start_url}",
                f"sso_region = {sso_region}",
                "sso_registration_scopes = sso:account:access",
                "",
            ] + result_lines

    # Append any new profiles not already in the file
    for block in new_profiles.values():
        result_lines.extend(block)

    CONFIG_PATH.write_text("\n".join(result_lines) + "\n")
