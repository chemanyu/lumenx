import os
import time
import secrets
import requests
import jwt
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

DINGTALK_CLIENT_ID = "dingxsfhrdnugj775coc"
DINGTALK_CLIENT_SECRET = "cRtwbTLMQJM8D5-DA8pTF4ilNjOIYCqdFe2hfEJ02jD30GaRpbxGwOdOmLWV-_e1"
JWT_SECRET = os.getenv("JWT_SECRET", secrets.token_hex(32))
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_DAYS = 30

# state_token -> { redirect_base: str, expires_at: float }
_oauth_states: dict = {}


def create_oauth_state(redirect_base: str, frontend_base: str) -> str:
    state = secrets.token_urlsafe(24)
    _oauth_states[state] = {
        "redirect_base": redirect_base,
        "frontend_base": frontend_base,
        "expires_at": time.time() + 600,
    }
    return state


def consume_oauth_state(state: str) -> Optional[tuple]:
    entry = _oauth_states.pop(state, None)
    if not entry or time.time() > entry["expires_at"]:
        return None
    return entry["redirect_base"], entry["frontend_base"]


def exchange_code_for_token(code: str) -> dict:
    resp = requests.post(
        "https://api.dingtalk.com/v1.0/oauth2/userAccessToken",
        json={
            "clientId": DINGTALK_CLIENT_ID,
            "clientSecret": DINGTALK_CLIENT_SECRET,
            "code": code,
            "grantType": "authorization_code",
        },
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()


def get_dingtalk_user_info(access_token: str) -> dict:
    resp = requests.get(
        "https://api.dingtalk.com/v1.0/contact/users/me",
        headers={"x-acs-dingtalk-access-token": access_token},
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()


def create_jwt(user_info: dict) -> str:
    payload = {
        "sub": user_info["unionId"],
        "openId": user_info.get("openId"),
        "name": user_info.get("nick", ""),
        "avatarUrl": user_info.get("avatarUrl", ""),
        "iat": int(time.time()),
        "exp": int(time.time()) + JWT_EXPIRE_DAYS * 86400,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_jwt(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])


_bearer = HTTPBearer()


def require_auth(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> dict:
    try:
        return verify_jwt(credentials.credentials)
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired"
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        )
