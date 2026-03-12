import boto3
from botocore.config import Config


def get_aws_session(profile: str | None = None, region: str | None = None) -> boto3.Session:
    kwargs: dict = {}
    if profile:
        kwargs["profile_name"] = profile
    if region:
        kwargs["region_name"] = region
    return boto3.Session(**kwargs)


def get_rds_client(profile: str | None, region: str):
    session = get_aws_session(profile, region)
    return session.client("rds", config=Config(retries={"max_attempts": 3, "mode": "standard"}))


def get_sso_client(region: str):
    """sso-oidc client — no profile, used for device authorization flow."""
    return boto3.client("sso-oidc", region_name=region)


def get_sso_portal_client(region: str):
    """sso portal client — no profile, accessToken passed explicitly to API calls."""
    return boto3.client("sso", region_name=region)
