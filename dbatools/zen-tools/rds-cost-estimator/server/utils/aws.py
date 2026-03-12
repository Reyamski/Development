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


def get_pricing_client():
    """AWS Pricing API is only available in us-east-1 regardless of target region."""
    return boto3.client("pricing", region_name="us-east-1")
